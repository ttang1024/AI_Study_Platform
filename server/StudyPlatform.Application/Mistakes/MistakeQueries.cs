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
        if (entries.Count == 0 && await TryBackfillOnceAsync(request.UserId, cancellationToken))
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

    /// <summary>
    /// Runs the submission replay at most once per user, then stamps the user so an empty notebook
    /// (a spotless quiz record backfills nothing) can't re-scan the whole history on every open.
    /// Returns true if the replay wrote anything.
    /// </summary>
    private async Task<bool> TryBackfillOnceAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(userId, cancellationToken);
        if (user is null || user.MistakesBackfilledAt.HasValue) return false;

        var wroteAnything = await BackfillFromSubmissionsAsync(userId, cancellationToken);

        user.MistakesBackfilledAt = DateTime.UtcNow;
        _unitOfWork.Users.Update(user);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return wroteAnything;
    }

    /// <summary>Replays stored quiz submissions through the capture logic. Returns true if anything was written.</summary>
    private async Task<bool> BackfillFromSubmissionsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var submissions = (await _unitOfWork.QuizSubmissions.FindAsNoTrackingAsync(s => s.UserId == userId, cancellationToken)).ToList();
        if (submissions.Count == 0) return false;

        var quizzes = (await _unitOfWork.Quizzes.FindAsNoTrackingAsync(q => q.UserId == userId, cancellationToken)).ToList();
        if (quizzes.Count == 0) return false;

        // Indexed once up front — the per-submission source lookup below used to re-scan the
        // user's whole quiz list, which is O(submissions x quizzes) over a full history.
        // A submission whose own source id is null matches nothing (it can't identify a source),
        // rather than sweeping up every quiz that happens to have a null id on that column.
        var quizzesByDocument = QuizzesBySource(quizzes, q => q.DocumentId);
        var quizzesByVideo = QuizzesBySource(quizzes, q => q.VideoId);

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
                ? LookupSource(quizzesByVideo, submission.VideoId)
                : LookupSource(quizzesByDocument, submission.DocumentId);
            if (sourceQuizzes.Count == 0) continue;

            await MistakeCapture.CaptureForQuizzesAsync(
                _unitOfWork, userId, sourceQuizzes, answers, cancellationToken, submission.SubmittedAt);
            wroteAnything = true;
        }

        return wroteAnything;
    }

    private static Dictionary<Guid, List<Domain.Entities.Quiz>> QuizzesBySource(
        List<Domain.Entities.Quiz> quizzes, Func<Domain.Entities.Quiz, Guid?> sourceId)
        => quizzes
            .Where(q => sourceId(q).HasValue)
            .GroupBy(q => sourceId(q)!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

    private static IReadOnlyList<Domain.Entities.Quiz> LookupSource(
        Dictionary<Guid, List<Domain.Entities.Quiz>> bySource, Guid? sourceId)
        => sourceId.HasValue && bySource.TryGetValue(sourceId.Value, out var quizzes)
            ? quizzes
            : Array.Empty<Domain.Entities.Quiz>();

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
