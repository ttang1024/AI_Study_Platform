using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using System.Text.RegularExpressions;

namespace StudyPlatform.Application.ConceptLinks;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record ConceptLinkDto(
    Guid ConceptLinkId,
    Guid UserId,
    string SourceEntityType,
    Guid SourceEntityId,
    string TargetEntityType,
    Guid TargetEntityId,
    string? LinkLabel,
    DateTime CreatedAt);

public record NodeDto(string Id, string Type, string Title, string? Subtitle = null, string? Url = null, int Weight = 1);
public record EdgeDto(string Source, string Target, string? Label, int Weight = 1);
public record KnowledgeGraphStatsDto(int Materials, int Concepts, int Notes, int Quizzes, int Links);
public record KnowledgeGraphDto(IEnumerable<NodeDto> Nodes, IEnumerable<EdgeDto> Edges, KnowledgeGraphStatsDto Stats);

// ── Queries ─────────────────────────────────────────────────────────────────

public record GetKnowledgeGraphQuery(Guid UserId) : IRequest<Result<KnowledgeGraphDto>>;

public class GetKnowledgeGraphQueryHandler : IRequestHandler<GetKnowledgeGraphQuery, Result<KnowledgeGraphDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetKnowledgeGraphQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<KnowledgeGraphDto>> Handle(GetKnowledgeGraphQuery request, CancellationToken cancellationToken)
    {
        var links = (await _unitOfWork.ConceptLinks.GetByUserAsync(request.UserId, cancellationToken)).ToList();
        var documents = (await _unitOfWork.Documents.FindAsync(d => d.UserId == request.UserId, cancellationToken)).ToList();
        var videos = (await _unitOfWork.YouTubeVideos.FindAsync(v => v.UserId == request.UserId, cancellationToken)).ToList();
        var notes = (await _unitOfWork.Notes.GetByUserIdAsync(request.UserId, cancellationToken)).ToList();
        var quizzes = (await _unitOfWork.Quizzes.FindAsync(q => q.UserId == request.UserId, cancellationToken)).ToList();
        var glossaryTerms = (await _unitOfWork.GlossaryTerms.GetByUserWithSourcesAsync(request.UserId, cancellationToken)).ToList();

        var nodes = new Dictionary<string, NodeDto>(StringComparer.OrdinalIgnoreCase);
        var edgeWeights = new Dictionary<(string Source, string Target, string Label), int>();
        var knownConcepts = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        void AddNode(NodeDto node)
        {
            if (nodes.TryGetValue(node.Id, out var existing))
            {
                nodes[node.Id] = existing with { Weight = Math.Max(existing.Weight, node.Weight) + 1 };
                return;
            }
            nodes[node.Id] = node;
        }

        void AddEdge(string source, string target, string label)
        {
            if (source.Equals(target, StringComparison.OrdinalIgnoreCase)) return;
            var key = string.Compare(source, target, StringComparison.OrdinalIgnoreCase) <= 0
                ? (source, target, label)
                : (target, source, label);
            edgeWeights[key] = edgeWeights.TryGetValue(key, out var weight) ? weight + 1 : 1;
        }

        string AddConcept(string term, int weight = 1)
        {
            var title = CleanTitle(term);
            var normalized = NormalizeConcept(title);
            if (string.IsNullOrWhiteSpace(normalized))
                normalized = "concept";
            var id = $"concept:{normalized}";
            knownConcepts[title] = id;
            AddNode(new NodeDto(id, "concept", title, "Shared concept", $"/glossary?search={Uri.EscapeDataString(title)}", weight));
            return id;
        }

        foreach (var doc in documents)
        {
            var type = GetDocumentNodeType(doc);
            AddNode(new NodeDto(
                $"document:{doc.DocumentId}",
                type,
                doc.FileName,
                GetDocumentSubtitle(doc),
                GetDocumentUrl(doc),
                HasStudyArtifacts(doc) ? 3 : 1));

            foreach (var concept in ExtractMindMapConcepts(doc.MindMapText).Take(24))
                AddEdge($"document:{doc.DocumentId}", AddConcept(concept), "covers");
        }

        foreach (var video in videos)
        {
            AddNode(new NodeDto(
                $"video:{video.YouTubeVideoId}",
                "video",
                string.IsNullOrWhiteSpace(video.Title) ? video.VideoId : video.Title,
                "YouTube video",
                $"/youtube/{video.YouTubeVideoId}",
                HasStudyArtifacts(video) ? 3 : 1));

            foreach (var concept in ExtractMindMapConcepts(video.MindMapText).Take(24))
                AddEdge($"video:{video.YouTubeVideoId}", AddConcept(concept), "covers");
        }

        foreach (var term in glossaryTerms)
        {
            var conceptId = AddConcept(term.Term, 2);
            if (term.DocumentId.HasValue)
                AddEdge($"document:{term.DocumentId.Value}", conceptId, "defines");
            if (term.YouTubeVideoId.HasValue)
                AddEdge($"video:{term.YouTubeVideoId.Value}", conceptId, "defines");
        }

        foreach (var note in notes.Take(120))
        {
            var sourceId = GetSourceNodeId(note.DocumentId, note.YouTubeVideoId);
            var noteId = $"note:{note.NoteId}";
            AddNode(new NodeDto(noteId, "note", GetNoteTitle(note), GetSourceTitle(note.Document, note.YouTubeVideo), "/notes"));
            if (sourceId is not null)
                AddEdge(sourceId, noteId, "has note");

            foreach (var conceptId in FindConceptsInText(note.Title + " " + note.Content, knownConcepts).Take(8))
                AddEdge(noteId, conceptId, "mentions");
        }

        foreach (var group in quizzes.GroupBy(q => GetSourceNodeId(q.DocumentId, q.YouTubeVideoId)).Where(g => g.Key is not null).Take(120))
        {
            var quizId = $"quiz:{group.Key}";
            AddNode(new NodeDto(quizId, "quiz", $"{group.Count()} quiz question{(group.Count() == 1 ? "" : "s")}", "Generated quiz", "/quizzes", Math.Min(group.Count(), 8)));
            AddEdge(group.Key!, quizId, "has quiz");

            var quizText = string.Join(" ", group.Select(q => $"{q.Question} {q.Explanation}"));
            foreach (var conceptId in FindConceptsInText(quizText, knownConcepts).Take(10))
                AddEdge(quizId, conceptId, "checks");
        }

        foreach (var link in links)
        {
            var source = $"{NormalizeEntityType(link.SourceEntityType)}:{link.SourceEntityId}";
            var target = $"{NormalizeEntityType(link.TargetEntityType)}:{link.TargetEntityId}";
            await EnsureLinkedNodeAsync(source, nodes, cancellationToken);
            await EnsureLinkedNodeAsync(target, nodes, cancellationToken);
            AddEdge(source, target, link.LinkLabel ?? "related");
        }

        var edges = edgeWeights
            .Select(kvp => new EdgeDto(kvp.Key.Source, kvp.Key.Target, kvp.Key.Label, kvp.Value))
            .Where(e => nodes.ContainsKey(e.Source) && nodes.ContainsKey(e.Target))
            .OrderByDescending(e => e.Weight)
            .Take(360)
            .ToList();

        var connectedNodeIds = edges.SelectMany(e => new[] { e.Source, e.Target }).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var orderedNodes = nodes.Values
            .Where(n => connectedNodeIds.Contains(n.Id) || n.Type is "document" or "video" or "audio" or "podcast" or "article")
            .OrderByDescending(n => n.Weight)
            .Take(220)
            .ToList();
        var includedIds = orderedNodes.Select(n => n.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        edges = edges.Where(e => includedIds.Contains(e.Source) && includedIds.Contains(e.Target)).ToList();

        var stats = new KnowledgeGraphStatsDto(
            orderedNodes.Count(n => n.Type is "document" or "video" or "audio" or "podcast" or "article"),
            orderedNodes.Count(n => n.Type == "concept"),
            orderedNodes.Count(n => n.Type == "note"),
            orderedNodes.Count(n => n.Type == "quiz"),
            edges.Count);

        return Result<KnowledgeGraphDto>.Success(new KnowledgeGraphDto(orderedNodes, edges, stats));
    }

    private async Task EnsureLinkedNodeAsync(string nodeId, Dictionary<string, NodeDto> nodes, CancellationToken cancellationToken)
    {
        if (nodes.ContainsKey(nodeId)) return;

        var parts = nodeId.Split(':', 2);
        if (parts.Length != 2 || !Guid.TryParse(parts[1], out var id))
        {
            nodes[nodeId] = new NodeDto(nodeId, parts[0], parts.LastOrDefault() ?? nodeId);
            return;
        }

        switch (parts[0])
        {
            case "document":
                var doc = await _unitOfWork.Documents.GetByIdAsync(id, cancellationToken);
                nodes[nodeId] = doc is null
                    ? new NodeDto(nodeId, "document", id.ToString())
                    : new NodeDto(nodeId, GetDocumentNodeType(doc), doc.FileName, GetDocumentSubtitle(doc), GetDocumentUrl(doc));
                break;
            case "video":
                var video = await _unitOfWork.YouTubeVideos.GetByIdAsync(id, cancellationToken);
                nodes[nodeId] = video is null
                    ? new NodeDto(nodeId, "video", id.ToString())
                    : new NodeDto(nodeId, "video", string.IsNullOrWhiteSpace(video.Title) ? video.VideoId : video.Title, "YouTube video", $"/youtube/{video.YouTubeVideoId}");
                break;
            case "note":
                var note = await _unitOfWork.Notes.GetByIdAsync(id, cancellationToken);
                nodes[nodeId] = new NodeDto(nodeId, "note", note is null ? id.ToString() : GetNoteTitle(note), null, "/notes");
                break;
            case "glossary":
                var term = await _unitOfWork.GlossaryTerms.GetByIdAsync(id, cancellationToken);
                nodes[nodeId] = new NodeDto(nodeId, "concept", term?.Term ?? id.ToString(), "Glossary term", "/glossary");
                break;
            case "flashcard":
                var flashcard = await _unitOfWork.Flashcards.GetByIdAsync(id, cancellationToken);
                nodes[nodeId] = new NodeDto(nodeId, "flashcard", flashcard?.Front ?? id.ToString(), "Flashcard", "/flashcards");
                break;
            default:
                nodes[nodeId] = new NodeDto(nodeId, parts[0], id.ToString());
                break;
        }
    }

    private static string? GetSourceNodeId(Guid? documentId, Guid? videoId)
        => documentId.HasValue ? $"document:{documentId.Value}" : videoId.HasValue ? $"video:{videoId.Value}" : null;

    private static string GetSourceTitle(Document? document, YouTubeVideo? video)
        => document?.FileName ?? video?.Title ?? "Standalone note";

    private static string GetNoteTitle(Note note)
    {
        if (!string.IsNullOrWhiteSpace(note.Title)) return note.Title;
        var text = Regex.Replace(note.Content, @"\s+", " ").Trim();
        return string.IsNullOrWhiteSpace(text) ? "Untitled note" : Truncate(text, 64);
    }

    private static string NormalizeEntityType(string type)
        => type.Equals("youtube", StringComparison.OrdinalIgnoreCase) || type.Equals("youtubeVideo", StringComparison.OrdinalIgnoreCase)
            ? "video"
            : type.Trim().ToLowerInvariant();

    private static bool HasStudyArtifacts(Document doc)
        => !string.IsNullOrWhiteSpace(doc.Summary) || !string.IsNullOrWhiteSpace(doc.MindMapText) || !string.IsNullOrWhiteSpace(doc.Transcript);

    private static bool HasStudyArtifacts(YouTubeVideo video)
        => !string.IsNullOrWhiteSpace(video.Summary) || !string.IsNullOrWhiteSpace(video.MindMapText) || !string.IsNullOrWhiteSpace(video.Transcript);

    private static string GetDocumentNodeType(Document doc)
    {
        var contentType = doc.ContentType.ToLowerInvariant();
        var fileName = doc.FileName.ToLowerInvariant();
        if (contentType == "audio/podcast") return "podcast";
        if (contentType.StartsWith("audio/") || Regex.IsMatch(fileName, @"\.(mp3|m4a|wav|ogg|aac|flac|webm)$")) return "audio";
        if (!string.IsNullOrWhiteSpace(doc.OriginalUrl)) return "article";
        return "document";
    }

    private static string GetDocumentSubtitle(Document doc)
        => GetDocumentNodeType(doc) switch
        {
            "podcast" => "Podcast episode",
            "audio" => "Audio material",
            "article" => "Web article",
            _ => "Document"
        };

    private static string GetDocumentUrl(Document doc)
        => GetDocumentNodeType(doc) switch
        {
            "podcast" or "audio" => $"/audio/{doc.DocumentId}",
            "article" => $"/articles/{doc.DocumentId}",
            _ => $"/documents/{doc.DocumentId}"
        };

    private static IEnumerable<string> ExtractMindMapConcepts(string? mindMapText)
    {
        if (string.IsNullOrWhiteSpace(mindMapText)) yield break;

        foreach (var rawLine in mindMapText.Split('\n'))
        {
            var line = rawLine.Trim();
            if (line.Length < 3 || line.StartsWith("```")) continue;
            line = Regex.Replace(line, @"^[-*#\s]+", string.Empty).Trim();
            line = Regex.Replace(line, @"^\d+[\.)]\s*", string.Empty).Trim();
            line = Regex.Replace(line, @":\s.*$", string.Empty).Trim();
            if (line.Length is < 3 or > 80) continue;
            if (line.Contains("example", StringComparison.OrdinalIgnoreCase)) continue;
            yield return line;
        }
    }

    private static IEnumerable<string> FindConceptsInText(string? text, Dictionary<string, string> knownConcepts)
    {
        if (string.IsNullOrWhiteSpace(text)) yield break;
        foreach (var concept in knownConcepts)
        {
            if (concept.Key.Length < 3) continue;
            if (text.Contains(concept.Key, StringComparison.OrdinalIgnoreCase))
                yield return concept.Value;
        }
    }

    private static string NormalizeConcept(string term)
        => Regex.Replace(term.Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');

    private static string CleanTitle(string text)
        => Truncate(Regex.Replace(text, @"\s+", " ").Trim().Trim('-', '*', '#'), 80);

    private static string Truncate(string text, int maxLength)
        => text.Length <= maxLength ? text : text[..maxLength].TrimEnd() + "...";
}

// ── Commands ─────────────────────────────────────────────────────────────────

public record CreateConceptLinkCommand(
    Guid UserId,
    string SourceType,
    Guid SourceId,
    string TargetType,
    Guid TargetId,
    string? Label) : IRequest<Result<ConceptLinkDto>>;

public class CreateConceptLinkCommandHandler : IRequestHandler<CreateConceptLinkCommand, Result<ConceptLinkDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public CreateConceptLinkCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<ConceptLinkDto>> Handle(CreateConceptLinkCommand request, CancellationToken cancellationToken)
    {
        var link = new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = request.UserId,
            SourceEntityType = request.SourceType,
            SourceEntityId = request.SourceId,
            TargetEntityType = request.TargetType,
            TargetEntityId = request.TargetId,
            LinkLabel = request.Label,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.ConceptLinks.AddAsync(link, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ConceptLinkDto>.Success(ToDto(link), "Concept link created.");
    }

    internal static ConceptLinkDto ToDto(ConceptLink l) =>
        new(l.ConceptLinkId, l.UserId, l.SourceEntityType, l.SourceEntityId, l.TargetEntityType, l.TargetEntityId, l.LinkLabel, l.CreatedAt);
}

public record DeleteConceptLinkCommand(Guid UserId, Guid LinkId) : IRequest<Result>;

public class DeleteConceptLinkCommandHandler : IRequestHandler<DeleteConceptLinkCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public DeleteConceptLinkCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(DeleteConceptLinkCommand request, CancellationToken cancellationToken)
    {
        var link = await _unitOfWork.ConceptLinks.GetByIdAsync(request.LinkId, cancellationToken);
        if (link == null || link.UserId != request.UserId)
            return Result.Failure("Concept link not found.", "NOT_FOUND");

        _unitOfWork.ConceptLinks.Remove(link);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Concept link deleted.");
    }
}
