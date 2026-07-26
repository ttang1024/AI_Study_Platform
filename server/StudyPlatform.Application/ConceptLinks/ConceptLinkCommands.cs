using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using System.Text.RegularExpressions;

namespace StudyPlatform.Application.ConceptLinks;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record NodeDto(string Id, string Type, string Title, string? Subtitle = null, string? Url = null, int Weight = 1, string? Description = null, string? CourseId = null);
public record EdgeDto(string Source, string Target, string? Label, int Weight = 1);
public record KnowledgeGraphStatsDto(int Materials, int Concepts, int Notes, int Quizzes, int Links);
public record KnowledgeGraphDto(IEnumerable<NodeDto> Nodes, IEnumerable<EdgeDto> Edges, KnowledgeGraphStatsDto Stats);

// ── Queries ─────────────────────────────────────────────────────────────────

public record GetKnowledgeGraphQuery(Guid UserId) : IRequest<Result<KnowledgeGraphDto>>;

public class GetKnowledgeGraphQueryHandler : IRequestHandler<GetKnowledgeGraphQuery, Result<KnowledgeGraphDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetKnowledgeGraphQueryHandler(IUnitOfWork unitOfWork, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<Result<KnowledgeGraphDto>> Handle(GetKnowledgeGraphQuery request, CancellationToken cancellationToken)
    {
        var result = await _cache.GetOrCreateAsync(
            $"concept-links:graph:user:{request.UserId}",
            ct => ComputeAsync(request.UserId, ct),
            TimeSpan.FromSeconds(_cacheOptions.KnowledgeGraphSeconds),
            cancellationToken);
        return Result<KnowledgeGraphDto>.Success(result);
    }

    private async Task<KnowledgeGraphDto> ComputeAsync(Guid userId, CancellationToken cancellationToken)
    {
        var links = (await _unitOfWork.ConceptLinks.GetByUserAsync(userId, cancellationToken)).ToList();
        var documents = await _unitOfWork.Documents.GetGraphNodesAsync(userId, cancellationToken);
        var videos = await _unitOfWork.Videos.GetGraphNodesAsync(userId, cancellationToken);
        var notes = (await _unitOfWork.Notes.GetByUserIdAsync(userId, cancellationToken)).ToList();
        var quizzes = (await _unitOfWork.Quizzes.FindAsNoTrackingAsync(q => q.UserId == userId, cancellationToken)).ToList();
        var glossaryTerms = (await _unitOfWork.GlossaryTerms.GetByUserWithSourcesAsync(userId, cancellationToken)).ToList();

        var nodes = new Dictionary<string, NodeDto>(StringComparer.OrdinalIgnoreCase);
        var edgeWeights = new Dictionary<(string Source, string Target, string Label), int>();
        // Same pairs as edgeWeights but label-blind, so "are these two already connected?" is a lookup
        // rather than a scan of every edge built so far — the per-course chaining below asks it once
        // per material, which made the whole pass quadratic in edges.
        var connectedPairs = new HashSet<(string Source, string Target)>(EdgePairComparer.Instance);
        var knownConcepts = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        void AddNode(NodeDto node)
        {
            if (nodes.TryGetValue(node.Id, out var existing))
            {
                nodes[node.Id] = existing with {
                    Weight = Math.Max(existing.Weight, node.Weight) + 1,
                    Description = existing.Description ?? node.Description,
                };
                return;
            }
            nodes[node.Id] = node;
        }

        (string Source, string Target) GetEdgePair(string source, string target)
            => string.Compare(source, target, StringComparison.OrdinalIgnoreCase) <= 0
                ? (source, target)
                : (target, source);

        bool HasEdgeBetween(string source, string target)
            => connectedPairs.Contains(GetEdgePair(source, target));

        void AddEdge(string source, string target, string label)
        {
            if (source.Equals(target, StringComparison.OrdinalIgnoreCase)) return;
            var pair = GetEdgePair(source, target);
            var key = (pair.Source, pair.Target, label);
            edgeWeights[key] = edgeWeights.TryGetValue(key, out var weight) ? weight + 1 : 1;
            connectedPairs.Add(pair);
        }

        void AddEdgeIfUnconnected(string source, string target, string label)
        {
            if (!HasEdgeBetween(source, target))
                AddEdge(source, target, label);
        }

        string AddConcept(string term, int weight = 1, string? description = null)
        {
            var title = CleanTitle(term);
            var normalized = NormalizeConcept(title);
            if (string.IsNullOrWhiteSpace(normalized))
                normalized = "concept";
            var id = $"concept:{normalized}";
            knownConcepts[title] = id;
            AddNode(new NodeDto(id, "concept", title, "Shared concept", $"/glossary?search={Uri.EscapeDataString(title)}", weight, description));
            return id;
        }

        foreach (var doc in documents)
        {
            AddNode(new NodeDto(
                $"document:{doc.DocumentId}",
                GetDocumentNodeType(doc.ContentType, doc.FileName, doc.OriginalUrl),
                doc.FileName,
                GetDocumentSubtitle(doc.ContentType, doc.FileName, doc.OriginalUrl),
                GetDocumentUrl(doc.DocumentId, doc.ContentType, doc.FileName, doc.OriginalUrl),
                doc.HasStudyArtifacts ? 3 : 1,
                null,
                doc.CourseId.ToString()));
        }

        foreach (var video in videos)
        {
            AddNode(new NodeDto(
                $"video:{video.VideoId}",
                "video",
                string.IsNullOrWhiteSpace(video.Title) ? video.ExternalVideoId : video.Title,
                "Video",
                $"/videos/{video.VideoId}",
                video.HasStudyArtifacts ? 3 : 1,
                null,
                video.CourseId.ToString()));
        }

        foreach (var term in glossaryTerms)
        {
            var conceptId = AddConcept(term.Term, 2, term.Definition);
            if (term.DocumentId.HasValue)
                AddEdge($"document:{term.DocumentId.Value}", conceptId, "defines");
            if (term.VideoId.HasValue)
                AddEdge($"video:{term.VideoId.Value}", conceptId, "defines");
        }

        foreach (var note in notes.Take(120))
        {
            var sourceId = GetSourceNodeId(note.DocumentId, note.VideoId);
            var noteId = $"note:{note.NoteId}";
            AddNode(new NodeDto(noteId, "note", GetNoteTitle(note), GetSourceTitle(note.Document, note.Video), "/notes"));
            if (sourceId is not null)
                AddEdge(sourceId, noteId, "has note");

            foreach (var conceptId in FindConceptsInText(note.Title + " " + note.Content, knownConcepts).Take(8))
                AddEdge(noteId, conceptId, "mentions");
        }

        foreach (var group in quizzes.GroupBy(q => GetSourceNodeId(q.DocumentId, q.VideoId)).Where(g => g.Key is not null).Take(120))
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

        foreach (var courseMaterials in nodes.Values
            .Where(IsCourseMaterialNode)
            .GroupBy(n => n.CourseId, StringComparer.OrdinalIgnoreCase))
        {
            var materials = courseMaterials
                .OrderBy(n => GetMaterialSortRank(n.Type))
                .ThenBy(n => n.Title, StringComparer.OrdinalIgnoreCase)
                .ThenBy(n => n.Id, StringComparer.OrdinalIgnoreCase)
                .ToList();

            for (var i = 1; i < materials.Count; i++)
                AddEdgeIfUnconnected(materials[i - 1].Id, materials[i].Id, "same course");
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

        return new KnowledgeGraphDto(orderedNodes, edges, stats);
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
                    : new NodeDto(
                        nodeId,
                        GetDocumentNodeType(doc.ContentType, doc.FileName, doc.OriginalUrl),
                        doc.FileName,
                        GetDocumentSubtitle(doc.ContentType, doc.FileName, doc.OriginalUrl),
                        GetDocumentUrl(doc.DocumentId, doc.ContentType, doc.FileName, doc.OriginalUrl));
                break;
            case "video":
                var video = await _unitOfWork.Videos.GetByIdAsync(id, cancellationToken);
                nodes[nodeId] = video is null
                    ? new NodeDto(nodeId, "video", id.ToString())
                    : new NodeDto(nodeId, "video", string.IsNullOrWhiteSpace(video.Title) ? video.ExternalVideoId : video.Title, "Video", $"/videos/{video.VideoId}");
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

    private static string GetSourceTitle(Document? document, Video? video)
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

    private static bool IsCourseMaterialNode(NodeDto node)
        => !string.IsNullOrWhiteSpace(node.CourseId)
           && node.Type is "document" or "video" or "audio" or "podcast" or "article";

    private static int GetMaterialSortRank(string type)
        => type switch
        {
            "document" => 0,
            "article" => 1,
            "audio" => 2,
            "podcast" => 3,
            "video" => 4,
            _ => 5
        };

    private static string GetDocumentNodeType(string documentContentType, string documentFileName, string? originalUrl)
    {
        var contentType = documentContentType.ToLowerInvariant();
        var fileName = documentFileName.ToLowerInvariant();
        if (contentType == "audio/podcast") return "podcast";
        if (contentType.StartsWith("audio/") || Regex.IsMatch(fileName, @"\.(mp3|m4a|wav|ogg|aac|flac|webm)$")) return "audio";
        if (!string.IsNullOrWhiteSpace(originalUrl)) return "article";
        return "document";
    }

    private static string GetDocumentSubtitle(string contentType, string fileName, string? originalUrl)
        => GetDocumentNodeType(contentType, fileName, originalUrl) switch
        {
            "podcast" => "Podcast episode",
            "audio" => "Audio material",
            "article" => "Web article",
            _ => "Document"
        };

    private static string GetDocumentUrl(Guid documentId, string contentType, string fileName, string? originalUrl)
        => GetDocumentNodeType(contentType, fileName, originalUrl) switch
        {
            "podcast" or "audio" => $"/audio/{documentId}",
            "article" => $"/articles/{documentId}",
            _ => $"/documents/{documentId}"
        };

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

    /// <summary>Case-insensitive on both ends, matching how edge pairs are ordered and compared.</summary>
    private sealed class EdgePairComparer : IEqualityComparer<(string Source, string Target)>
    {
        public static readonly EdgePairComparer Instance = new();

        public bool Equals((string Source, string Target) x, (string Source, string Target) y)
            => string.Equals(x.Source, y.Source, StringComparison.OrdinalIgnoreCase)
               && string.Equals(x.Target, y.Target, StringComparison.OrdinalIgnoreCase);

        public int GetHashCode((string Source, string Target) pair)
            => HashCode.Combine(
                StringComparer.OrdinalIgnoreCase.GetHashCode(pair.Source),
                StringComparer.OrdinalIgnoreCase.GetHashCode(pair.Target));
    }
}
