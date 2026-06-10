using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.ConceptLinks;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record LearningPathStepDto(
    int Order,
    Guid TermId,
    string Concept,
    string Status,      // "next" | "ready" | "blocked" | "mastered"
    string Reason,
    int PrerequisiteDepth,
    IReadOnlyList<string> Prerequisites,
    string? Url);

public record LearningPathDto(IReadOnlyList<LearningPathStepDto> Steps, int MasteredCount, int TotalCount);

// ── Query ───────────────────────────────────────────────────────────────────

/// <summary>
/// Turns the knowledge graph into navigation: orders the user's glossary concepts so
/// prerequisites (concepts that other concepts link to) come first, unmastered ones are
/// prioritized, and each step says why it's next.
/// </summary>
public record GetLearningPathQuery(Guid UserId) : IRequest<Result<LearningPathDto>>;

public class GetLearningPathQueryHandler : IRequestHandler<GetLearningPathQuery, Result<LearningPathDto>>
{
    private const int MaxSteps = 40;

    private readonly IUnitOfWork _unitOfWork;

    public GetLearningPathQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<LearningPathDto>> Handle(GetLearningPathQuery request, CancellationToken cancellationToken)
    {
        var userId = request.UserId;
        var terms = (await _unitOfWork.GlossaryTerms.FindAsync(t => t.UserId == userId, cancellationToken)).ToList();
        var mastered = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, cancellationToken)).ToHashSet();
        var links = (await _unitOfWork.ConceptLinks.GetByUserAsync(userId, cancellationToken)).ToList();

        if (terms.Count == 0)
            return Result<LearningPathDto>.Success(new LearningPathDto(Array.Empty<LearningPathStepDto>(), 0, 0));

        // Dedupe terms by name (the same concept can appear in several materials).
        var byName = terms
            .GroupBy(t => t.Term.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(g => new
            {
                Term = g.First(),
                Ids = g.Select(t => t.GlossaryTermId).ToHashSet(),
                Mastered = g.Any(t => mastered.Contains(t.GlossaryTermId)),
            })
            .ToList();

        var idToConcept = new Dictionary<Guid, int>();
        for (var i = 0; i < byName.Count; i++)
            foreach (var id in byName[i].Ids)
                idToConcept[id] = i;

        // Prerequisite edges: a link glossary→glossary means the source is needed to
        // understand the target ("defines", "expands on") — source comes earlier.
        var prereqs = new List<HashSet<int>>(byName.Count);
        for (var i = 0; i < byName.Count; i++) prereqs.Add(new HashSet<int>());

        foreach (var link in links)
        {
            if (!string.Equals(link.SourceEntityType, "glossary", StringComparison.OrdinalIgnoreCase)) continue;
            if (!string.Equals(link.TargetEntityType, "glossary", StringComparison.OrdinalIgnoreCase)) continue;
            if (!idToConcept.TryGetValue(link.SourceEntityId, out var src)) continue;
            if (!idToConcept.TryGetValue(link.TargetEntityId, out var dst)) continue;
            if (src != dst) prereqs[dst].Add(src);
        }

        // Depth = longest prerequisite chain (cycle-safe via visiting set).
        var depths = new int[byName.Count];
        Array.Fill(depths, -1);

        int Depth(int node, HashSet<int> visiting)
        {
            if (depths[node] >= 0) return depths[node];
            if (!visiting.Add(node)) return 0;
            var d = prereqs[node].Count == 0 ? 0 : prereqs[node].Max(p => Depth(p, visiting)) + 1;
            visiting.Remove(node);
            depths[node] = d;
            return d;
        }
        for (var i = 0; i < byName.Count; i++) Depth(i, new HashSet<int>());

        var ordered = Enumerable.Range(0, byName.Count)
            .OrderBy(i => byName[i].Mastered)            // unmastered first
            .ThenBy(i => depths[i])                       // prerequisites before dependents
            .ThenBy(i => prereqs[i].Count(p => !byName[p].Mastered)) // unblocked first
            .ThenBy(i => byName[i].Term.Term, StringComparer.OrdinalIgnoreCase)
            .Take(MaxSteps)
            .ToList();

        var steps = new List<LearningPathStepDto>();
        var nextAssigned = false;
        for (var rank = 0; rank < ordered.Count; rank++)
        {
            var i = ordered[rank];
            var entry = byName[i];
            var unmasteredPrereqs = prereqs[i]
                .Where(p => !byName[p].Mastered)
                .Select(p => byName[p].Term.Term)
                .ToList();

            string status;
            string reason;
            if (entry.Mastered)
            {
                status = "mastered";
                reason = "Already mastered — revisit only if it resurfaces in reviews.";
            }
            else if (unmasteredPrereqs.Count > 0)
            {
                status = "blocked";
                reason = $"Learn {string.Join(", ", unmasteredPrereqs.Take(3))} first — this concept builds on {(unmasteredPrereqs.Count == 1 ? "it" : "them")}.";
            }
            else if (!nextAssigned)
            {
                status = "next";
                reason = depths[i] > 0
                    ? "All prerequisites mastered — this is your highest-leverage next concept."
                    : "Foundational concept with no prerequisites — start here.";
                nextAssigned = true;
            }
            else
            {
                status = "ready";
                reason = "No unmastered prerequisites — ready whenever you are.";
            }

            steps.Add(new LearningPathStepDto(
                rank + 1, entry.Term.GlossaryTermId, entry.Term.Term, status, reason, depths[i],
                prereqs[i].Select(p => byName[p].Term.Term).ToList(),
                $"/glossary?search={Uri.EscapeDataString(entry.Term.Term)}"));
        }

        var masteredCount = byName.Count(e => e.Mastered);
        return Result<LearningPathDto>.Success(new LearningPathDto(steps, masteredCount, byName.Count));
    }
}
