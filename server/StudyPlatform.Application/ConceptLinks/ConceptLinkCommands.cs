using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

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

public record NodeDto(string Id, string Type, string Title);
public record EdgeDto(string Source, string Target, string? Label);
public record KnowledgeGraphDto(IEnumerable<NodeDto> Nodes, IEnumerable<EdgeDto> Edges);

// ── Queries ─────────────────────────────────────────────────────────────────

public record GetKnowledgeGraphQuery(Guid UserId) : IRequest<Result<KnowledgeGraphDto>>;

public class GetKnowledgeGraphQueryHandler : IRequestHandler<GetKnowledgeGraphQuery, Result<KnowledgeGraphDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetKnowledgeGraphQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<KnowledgeGraphDto>> Handle(GetKnowledgeGraphQuery request, CancellationToken cancellationToken)
    {
        var links = (await _unitOfWork.ConceptLinks.GetByUserAsync(request.UserId, cancellationToken)).ToList();

        // Collect all entity IDs by type
        var nodeMap = new Dictionary<string, string>(); // key: "type:id", value: title

        var documentIds = links
            .SelectMany(l => new[] { (l.SourceEntityType, l.SourceEntityId), (l.TargetEntityType, l.TargetEntityId) })
            .Where(x => x.Item1 == "document").Select(x => x.Item2).Distinct().ToList();
        var noteIds = links
            .SelectMany(l => new[] { (l.SourceEntityType, l.SourceEntityId), (l.TargetEntityType, l.TargetEntityId) })
            .Where(x => x.Item1 == "note").Select(x => x.Item2).Distinct().ToList();
        var flashcardIds = links
            .SelectMany(l => new[] { (l.SourceEntityType, l.SourceEntityId), (l.TargetEntityType, l.TargetEntityId) })
            .Where(x => x.Item1 == "flashcard").Select(x => x.Item2).Distinct().ToList();
        var glossaryIds = links
            .SelectMany(l => new[] { (l.SourceEntityType, l.SourceEntityId), (l.TargetEntityType, l.TargetEntityId) })
            .Where(x => x.Item1 == "glossary").Select(x => x.Item2).Distinct().ToList();

        foreach (var id in documentIds)
        {
            var doc = await _unitOfWork.Documents.GetByIdAsync(id, cancellationToken);
            nodeMap[$"document:{id}"] = doc?.FileName ?? id.ToString();
        }
        foreach (var id in noteIds)
        {
            var note = await _unitOfWork.Notes.GetByIdAsync(id, cancellationToken);
            nodeMap[$"note:{id}"] = note?.Title ?? note?.Content?.Substring(0, Math.Min(50, note.Content.Length)) ?? id.ToString();
        }
        foreach (var id in flashcardIds)
        {
            var fc = await _unitOfWork.Flashcards.GetByIdAsync(id, cancellationToken);
            nodeMap[$"flashcard:{id}"] = fc?.Front ?? id.ToString();
        }
        foreach (var id in glossaryIds)
        {
            var term = await _unitOfWork.GlossaryTerms.GetByIdAsync(id, cancellationToken);
            nodeMap[$"glossary:{id}"] = term?.Term ?? id.ToString();
        }

        var nodes = nodeMap.Select(kvp =>
        {
            var parts = kvp.Key.Split(':');
            return new NodeDto(kvp.Key, parts[0], kvp.Value);
        });

        var edges = links.Select(l => new EdgeDto(
            $"{l.SourceEntityType}:{l.SourceEntityId}",
            $"{l.TargetEntityType}:{l.TargetEntityId}",
            l.LinkLabel));

        return Result<KnowledgeGraphDto>.Success(new KnowledgeGraphDto(nodes, edges));
    }
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
