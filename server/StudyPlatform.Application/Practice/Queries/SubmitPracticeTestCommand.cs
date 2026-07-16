using MediatR;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Practice.Queries;

/// <summary>
/// Records practice-test results, feeding every mastery signal the platform already tracks:
/// quiz attempts (accuracy analytics), FSRS reviews for flashcards, and the mastered flags for
/// glossary terms / worked problems answered correctly. No new tables — it reuses existing paths.
/// </summary>
public record SubmitPracticeTestCommand(Guid UserId, IReadOnlyList<PracticeResultItem> Results)
    : IRequest<Result<PracticeTestSummaryDto>>;

public class SubmitPracticeTestCommandHandler : IRequestHandler<SubmitPracticeTestCommand, Result<PracticeTestSummaryDto>>
{
    private const int RatingGood = 3;
    private const int RatingAgain = 1;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;
    private readonly IAppCache _cache;

    public SubmitPracticeTestCommandHandler(IUnitOfWork unitOfWork, IMediator mediator, IAppCache cache)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
        _cache = cache;
    }

    public async Task<Result<PracticeTestSummaryDto>> Handle(SubmitPracticeTestCommand request, CancellationToken ct)
    {
        var results = request.Results ?? Array.Empty<PracticeResultItem>();
        var userId = request.UserId;

        var masteredTerms = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, ct)).ToHashSet();
        var masteredProblems = (await _unitOfWork.WorkedProblemMastered.GetMasteredProblemIdsByUserAsync(userId, ct)).ToHashSet();

        foreach (var item in results)
        {
            switch (item.Source)
            {
                case "quiz":
                    await _mediator.Send(new RecordQuizAttemptCommand(userId, item.SourceId, item.IsCorrect), ct);
                    break;

                case "flashcard":
                    await _mediator.Send(new ReviewFlashcardCommand(item.SourceId, userId, item.IsCorrect ? RatingGood : RatingAgain), ct);
                    break;

                case "glossary":
                    if (item.IsCorrect && masteredTerms.Add(item.SourceId))
                        await _unitOfWork.GlossaryMastered.AddAsync(
                            new GlossaryMastered { Id = Guid.NewGuid(), UserId = userId, GlossaryTermId = item.SourceId, MasteredAt = DateTime.UtcNow }, ct);
                    break;

                case "problem":
                    if (item.IsCorrect && masteredProblems.Add(item.SourceId))
                        await _unitOfWork.WorkedProblemMastered.AddAsync(
                            new WorkedProblemMastered { Id = Guid.NewGuid(), UserId = userId, WorkedProblemId = item.SourceId, MasteredAt = DateTime.UtcNow }, ct);
                    break;

                case "mistake":
                    // Smart-session redo of a mistake-notebook entry: a correct answer
                    // resolves it, a wrong one bumps its missed counter.
                    var mistake = (await _unitOfWork.MistakeEntries.FindAsync(
                        m => m.MistakeEntryId == item.SourceId && m.UserId == userId, ct)).FirstOrDefault();
                    if (mistake is null) break;
                    if (item.IsCorrect)
                    {
                        mistake.Status = "resolved";
                        mistake.ResolvedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        mistake.TimesMissed++;
                        mistake.LastMissedAt = DateTime.UtcNow;
                    }
                    break;
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);

        // Mastery signals changed — drop the cached summaries so the dashboard/today plan refresh.
        await _cache.RemoveAsync(DashboardSummaryCache.Key(userId), ct);
        await _cache.RemoveAsync($"recommendations:user:{userId}", ct);

        var total = results.Count;
        var correct = results.Count(r => r.IsCorrect);
        var accuracy = total > 0 ? Math.Round(correct * 100.0 / total, 1) : 0;
        return Result<PracticeTestSummaryDto>.Success(new PracticeTestSummaryDto(total, correct, accuracy));
    }
}
