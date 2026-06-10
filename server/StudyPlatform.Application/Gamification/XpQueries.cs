using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Gamification;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record XpBreakdownDto(string Source, string Label, int Xp);

public record UserXpDto(int TotalXp, int Level, int XpIntoLevel, int XpForNextLevel, double LevelProgress, IReadOnlyList<XpBreakdownDto> Breakdown);

public record LeaderboardEntryDto(Guid UserId, string Name, int Rank, int Xp, int StudyMinutes, int QuizCorrect, bool IsMe);

public record GroupLeaderboardDto(Guid GroupId, int Days, IReadOnlyList<LeaderboardEntryDto> Entries);

// ── Queries ─────────────────────────────────────────────────────────────────

/// <summary>Lifetime XP computed from existing activity tables — no separate event log to maintain.</summary>
public record GetUserXpQuery(Guid UserId) : IRequest<Result<UserXpDto>>;

/// <summary>Weekly XP ranking for a study group's members (study time + quiz correctness).</summary>
public record GetGroupLeaderboardQuery(Guid GroupId, Guid UserId, int Days = 7) : IRequest<Result<GroupLeaderboardDto>>;

// ── XP math shared by both queries ─────────────────────────────────────────

public static class XpMath
{
    public const int XpPerStudyMinute = 1;
    public const int XpPerQuizCorrect = 2;
    public const int XpPerFlashcardRep = 1;
    public const int XpPerTermMastered = 5;

    /// <summary>Level thresholds grow quadratically: level n starts at 100·(n−1)².</summary>
    public static (int Level, int XpIntoLevel, int XpForNextLevel) LevelFor(int totalXp)
    {
        var level = (int)Math.Floor(Math.Sqrt(Math.Max(0, totalXp) / 100.0)) + 1;
        var levelStart = 100 * (level - 1) * (level - 1);
        var nextStart = 100 * level * level;
        return (level, totalXp - levelStart, nextStart - levelStart);
    }
}

public class GetUserXpQueryHandler : IRequestHandler<GetUserXpQuery, Result<UserXpDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetUserXpQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UserXpDto>> Handle(GetUserXpQuery request, CancellationToken cancellationToken)
    {
        var userId = request.UserId;

        var sessions = await _unitOfWork.StudySessions.FindAsync(s => s.UserId == userId, cancellationToken);
        var studyMinutes = sessions.Sum(s => s.DurationSeconds) / 60;

        var submissions = await _unitOfWork.QuizSubmissions.FindAsync(s => s.UserId == userId, cancellationToken);
        var quizCorrect = submissions.Sum(s => s.Score);

        var srs = await _unitOfWork.FlashcardSrs.FindAsync(s => s.UserId == userId, cancellationToken);
        var reps = srs.Sum(s => s.Reps);

        var masteredTerms = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, cancellationToken)).Count();

        var breakdown = new List<XpBreakdownDto>
        {
            new("study-time", $"{studyMinutes} minutes studied", studyMinutes * XpMath.XpPerStudyMinute),
            new("quiz", $"{quizCorrect} quiz answers correct", quizCorrect * XpMath.XpPerQuizCorrect),
            new("flashcards", $"{reps} flashcard reviews", reps * XpMath.XpPerFlashcardRep),
            new("glossary", $"{masteredTerms} terms mastered", masteredTerms * XpMath.XpPerTermMastered),
        };

        var totalXp = breakdown.Sum(b => b.Xp);
        var (level, into, forNext) = XpMath.LevelFor(totalXp);

        return Result<UserXpDto>.Success(new UserXpDto(
            totalXp, level, into, forNext, forNext == 0 ? 0 : (double)into / forNext, breakdown));
    }
}

public class GetGroupLeaderboardQueryHandler : IRequestHandler<GetGroupLeaderboardQuery, Result<GroupLeaderboardDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetGroupLeaderboardQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<GroupLeaderboardDto>> Handle(GetGroupLeaderboardQuery request, CancellationToken cancellationToken)
    {
        var group = await _unitOfWork.StudyGroups.GetWithMembersAsync(request.GroupId, cancellationToken);
        if (group == null)
            return Result<GroupLeaderboardDto>.Failure("Group not found.", "GROUP_NOT_FOUND");
        if (group.Members.All(m => m.UserId != request.UserId))
            return Result<GroupLeaderboardDto>.Failure("You are not a member of this group.", "NOT_A_MEMBER");

        var days = Math.Clamp(request.Days, 1, 90);
        var since = DateTime.UtcNow.AddDays(-days);
        var memberIds = group.Members.Select(m => m.UserId).ToList();

        var sessions = await _unitOfWork.StudySessions.FindAsync(
            s => memberIds.Contains(s.UserId) && s.OccurredAt >= since, cancellationToken);
        var minutesByUser = sessions
            .GroupBy(s => s.UserId)
            .ToDictionary(g => g.Key, g => g.Sum(s => s.DurationSeconds) / 60);

        var submissions = await _unitOfWork.QuizSubmissions.FindAsync(
            s => memberIds.Contains(s.UserId) && s.SubmittedAt >= since, cancellationToken);
        var correctByUser = submissions
            .GroupBy(s => s.UserId)
            .ToDictionary(g => g.Key, g => g.Sum(s => s.Score));

        var entries = group.Members
            .Select(m =>
            {
                var minutes = minutesByUser.GetValueOrDefault(m.UserId);
                var correct = correctByUser.GetValueOrDefault(m.UserId);
                var xp = minutes * XpMath.XpPerStudyMinute + correct * XpMath.XpPerQuizCorrect;
                return new { m.UserId, Name = m.User?.FullName ?? "Member", Xp = xp, Minutes = minutes, Correct = correct };
            })
            .OrderByDescending(e => e.Xp)
            .ThenByDescending(e => e.Minutes)
            .Select((e, i) => new LeaderboardEntryDto(
                e.UserId, e.Name, i + 1, e.Xp, e.Minutes, e.Correct, e.UserId == request.UserId))
            .ToList();

        return Result<GroupLeaderboardDto>.Success(new GroupLeaderboardDto(request.GroupId, days, entries));
    }
}
