using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Mistakes;

public record GetMistakesQuery(Guid UserId, string? Status = null) : IRequest<Result<MistakesDto>>;

public class GetMistakesQueryHandler : IRequestHandler<GetMistakesQuery, Result<MistakesDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetMistakesQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<MistakesDto>> Handle(GetMistakesQuery request, CancellationToken cancellationToken)
    {
        var entries = (await _unitOfWork.MistakeEntries.FindAsNoTrackingAsync(m => m.UserId == request.UserId, cancellationToken)).ToList();

        // Mistakes are normally captured at submission time, but submissions that predate the
        // notebook never went through capture. First time a user with history opens an empty
        // notebook, replay their stored submissions once.
        if (entries.Count == 0 && await BackfillFromSubmissionsAsync(request.UserId, cancellationToken))
            entries = (await _unitOfWork.MistakeEntries.FindAsNoTrackingAsync(m => m.UserId == request.UserId, cancellationToken)).ToList();

        var openCount = entries.Count(m => m.Status == "open");
        var resolvedCount = entries.Count - openCount;

        var filtered = string.IsNullOrEmpty(request.Status)
            ? entries
            : entries.Where(m => m.Status == request.Status);

        var items = filtered
            .OrderByDescending(m => m.Status == "open")
            .ThenByDescending(m => m.TimesMissed)
            .ThenByDescending(m => m.LastMissedAt)
            .Select(ToDto)
            .ToList();

        return Result<MistakesDto>.Success(new MistakesDto(items, openCount, resolvedCount));
    }

    /// <summary>Replays stored quiz submissions through the capture logic. Returns true if anything was written.</summary>
    private async Task<bool> BackfillFromSubmissionsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var submissions = (await _unitOfWork.QuizSubmissions.FindAsNoTrackingAsync(s => s.UserId == userId, cancellationToken)).ToList();
        if (submissions.Count == 0) return false;

        var quizzes = (await _unitOfWork.Quizzes.FindAsNoTrackingAsync(q => q.UserId == userId, cancellationToken)).ToList();
        if (quizzes.Count == 0) return false;

        var wroteAnything = false;
        // Oldest first so a re-missed question's First/LastMissedAt come out in order.
        foreach (var submission in submissions.OrderBy(s => s.SubmittedAt))
        {
            Dictionary<string, string>? answers;
            try
            {
                answers = JsonSerializer.Deserialize<Dictionary<string, string>>(submission.AnswersJson);
            }
            catch (JsonException)
            {
                continue;
            }
            if (answers == null || answers.Count == 0) continue;

            var sourceQuizzes = submission.SourceType == "video"
                ? quizzes.Where(q => q.VideoId == submission.VideoId).ToList()
                : quizzes.Where(q => q.DocumentId == submission.DocumentId).ToList();
            if (sourceQuizzes.Count == 0) continue;

            await MistakeCapture.CaptureForQuizzesAsync(
                _unitOfWork, userId, sourceQuizzes, answers, cancellationToken, submission.SubmittedAt);
            wroteAnything = true;
        }

        if (wroteAnything)
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        return wroteAnything;
    }

    internal static MistakeDto ToDto(Domain.Entities.MistakeEntry m) => new(
        m.MistakeEntryId, m.QuizId, m.DocumentId, m.VideoId, m.SourceType,
        m.Question, ParseOptions(m.OptionsJson), m.CorrectAnswer, m.UserAnswer, m.Explanation,
        m.Status, m.TimesMissed, m.FirstMissedAt, m.LastMissedAt, m.ResolvedAt, m.FlashcardId);

    private static IReadOnlyList<string> ParseOptions(string optionsJson)
    {
        if (string.IsNullOrWhiteSpace(optionsJson)) return Array.Empty<string>();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(optionsJson) ?? new List<string>();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }
}
