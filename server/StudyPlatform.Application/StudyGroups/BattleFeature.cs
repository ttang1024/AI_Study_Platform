using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.StudyGroups;

// ── DTOs ────────────────────────────────────────────────────────────────────

/// <summary>A battle question as exposed to participants — the correct answer stays server-side.</summary>
public record BattleQuestionDto(string Id, string Question, IReadOnlyList<string> Options);

public record BattleEntryDto(Guid UserId, string Name, int Score, int Total, int DurationSeconds, DateTime CompletedAt, int Rank, bool IsMe);

public record BattleDto(
    Guid Id,
    Guid GroupId,
    Guid CreatedByUserId,
    string Title,
    string Status,
    int QuestionCount,
    DateTime CreatedAt,
    bool IHavePlayed,
    IReadOnlyList<BattleEntryDto> Entries);

public record BattlePlayDto(BattleDto Battle, IReadOnlyList<BattleQuestionDto> Questions);

public record BattleResultItemDto(string QuestionId, string Question, string CorrectAnswer, string UserAnswer, bool Correct, string Explanation);

public record BattleResultDto(int Score, int Total, IReadOnlyList<BattleResultItemDto> Items, BattleDto Battle);

/// <summary>Snapshot format stored in QuizBattle.QuestionsJson.</summary>
internal record BattleQuestion(string Id, string Question, List<string> Options, string CorrectAnswer, string Explanation);

// ── Requests ────────────────────────────────────────────────────────────────

public record CreateBattleCommand(Guid UserId, Guid GroupId, string Title, Guid? CourseId, int Count) : IRequest<Result<BattleDto>>;
public record GetGroupBattlesQuery(Guid UserId, Guid GroupId) : IRequest<Result<IReadOnlyList<BattleDto>>>;
public record GetBattlePlayQuery(Guid UserId, Guid BattleId) : IRequest<Result<BattlePlayDto>>;
public record SubmitBattleEntryCommand(Guid UserId, Guid BattleId, Dictionary<string, string> Answers, int DurationSeconds) : IRequest<Result<BattleResultDto>>;

// ── Shared helpers ──────────────────────────────────────────────────────────

internal static class BattleMapper
{
    public static async Task<bool> IsMemberAsync(IUnitOfWork uow, Guid groupId, Guid userId, CancellationToken ct)
        => (await uow.StudyGroupMembers.FindAsync(m => m.GroupId == groupId && m.UserId == userId, ct)).Any();

    public static BattleDto ToDto(QuizBattle battle, Guid currentUserId)
    {
        var entries = battle.Entries
            .OrderByDescending(e => e.Score)
            .ThenBy(e => e.DurationSeconds)
            .Select((e, i) => new BattleEntryDto(
                e.UserId, e.User?.FullName ?? "Member", e.Score, e.Total, e.DurationSeconds,
                e.CompletedAt, i + 1, e.UserId == currentUserId))
            .ToList();

        var questionCount = 0;
        try
        {
            questionCount = JsonSerializer.Deserialize<List<BattleQuestion>>(battle.QuestionsJson)?.Count ?? 0;
        }
        catch (JsonException) { /* corrupt snapshot — surface as 0 questions */ }

        return new BattleDto(
            battle.QuizBattleId, battle.GroupId, battle.CreatedByUserId, battle.Title, battle.Status,
            questionCount, battle.CreatedAt,
            entries.Any(e => e.UserId == currentUserId), entries);
    }
}

// ── Handlers ────────────────────────────────────────────────────────────────

public class CreateBattleCommandHandler : IRequestHandler<CreateBattleCommand, Result<BattleDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateBattleCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<BattleDto>> Handle(CreateBattleCommand request, CancellationToken cancellationToken)
    {
        if (!await BattleMapper.IsMemberAsync(_unitOfWork, request.GroupId, request.UserId, cancellationToken))
            return Result<BattleDto>.Failure("You are not a member of this group.", "NOT_A_MEMBER");

        var quizzes = (await _unitOfWork.Quizzes.FindAsync(q => q.UserId == request.UserId, cancellationToken)).ToList();
        if (request.CourseId.HasValue)
        {
            var docIds = (await _unitOfWork.Documents.FindAsync(
                d => d.UserId == request.UserId && d.CourseId == request.CourseId.Value, cancellationToken))
                .Select(d => d.DocumentId).ToHashSet();
            var videoIds = (await _unitOfWork.YouTubeVideos.FindAsync(
                v => v.UserId == request.UserId && v.CourseId == request.CourseId.Value, cancellationToken))
                .Select(v => v.YouTubeVideoId).ToHashSet();
            quizzes = quizzes.Where(q =>
                (q.DocumentId.HasValue && docIds.Contains(q.DocumentId.Value)) ||
                (q.YouTubeVideoId.HasValue && videoIds.Contains(q.YouTubeVideoId.Value))).ToList();
        }

        if (quizzes.Count == 0)
            return Result<BattleDto>.Failure("You have no quiz questions to battle with — generate quizzes first.", "NO_QUESTIONS");

        var count = Math.Clamp(request.Count, 3, 20);
        var snapshot = quizzes
            .OrderBy(_ => Random.Shared.Next())
            .Take(count)
            .Select(q => new BattleQuestion(
                q.QuizId.ToString(), q.Question, ParseOptions(q.OptionsJson), q.CorrectAnswer, q.Explanation))
            .ToList();

        var battle = new QuizBattle
        {
            QuizBattleId = Guid.NewGuid(),
            GroupId = request.GroupId,
            CreatedByUserId = request.UserId,
            Title = string.IsNullOrWhiteSpace(request.Title) ? $"Quiz battle · {snapshot.Count} questions" : request.Title.Trim(),
            QuestionsJson = JsonSerializer.Serialize(snapshot),
            Status = "open",
            CreatedAt = DateTime.UtcNow,
        };
        await _unitOfWork.QuizBattles.AddAsync(battle, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<BattleDto>.Success(BattleMapper.ToDto(battle, request.UserId), "Battle created.");
    }

    private static List<string> ParseOptions(string optionsJson)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(optionsJson) ?? new List<string>();
        }
        catch (JsonException)
        {
            return new List<string>();
        }
    }
}

public class GetGroupBattlesQueryHandler : IRequestHandler<GetGroupBattlesQuery, Result<IReadOnlyList<BattleDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetGroupBattlesQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IReadOnlyList<BattleDto>>> Handle(GetGroupBattlesQuery request, CancellationToken cancellationToken)
    {
        if (!await BattleMapper.IsMemberAsync(_unitOfWork, request.GroupId, request.UserId, cancellationToken))
            return Result<IReadOnlyList<BattleDto>>.Failure("You are not a member of this group.", "NOT_A_MEMBER");

        var battles = await _unitOfWork.QuizBattles.GetByGroupWithEntriesAsync(request.GroupId, cancellationToken);
        var dtos = battles.Select(b => BattleMapper.ToDto(b, request.UserId)).ToList();
        return Result<IReadOnlyList<BattleDto>>.Success(dtos);
    }
}

public class GetBattlePlayQueryHandler : IRequestHandler<GetBattlePlayQuery, Result<BattlePlayDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetBattlePlayQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<BattlePlayDto>> Handle(GetBattlePlayQuery request, CancellationToken cancellationToken)
    {
        var battle = await _unitOfWork.QuizBattles.GetByIdWithEntriesAsync(request.BattleId, cancellationToken);
        if (battle == null)
            return Result<BattlePlayDto>.Failure("Battle not found.", "BATTLE_NOT_FOUND");
        if (!await BattleMapper.IsMemberAsync(_unitOfWork, battle.GroupId, request.UserId, cancellationToken))
            return Result<BattlePlayDto>.Failure("You are not a member of this group.", "NOT_A_MEMBER");

        var questions = JsonSerializer.Deserialize<List<BattleQuestion>>(battle.QuestionsJson) ?? new List<BattleQuestion>();
        var dto = new BattlePlayDto(
            BattleMapper.ToDto(battle, request.UserId),
            questions.Select(q => new BattleQuestionDto(q.Id, q.Question, q.Options)).ToList());
        return Result<BattlePlayDto>.Success(dto);
    }
}

public class SubmitBattleEntryCommandHandler : IRequestHandler<SubmitBattleEntryCommand, Result<BattleResultDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public SubmitBattleEntryCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<BattleResultDto>> Handle(SubmitBattleEntryCommand request, CancellationToken cancellationToken)
    {
        var battle = await _unitOfWork.QuizBattles.GetByIdWithEntriesAsync(request.BattleId, cancellationToken);
        if (battle == null)
            return Result<BattleResultDto>.Failure("Battle not found.", "BATTLE_NOT_FOUND");
        if (!await BattleMapper.IsMemberAsync(_unitOfWork, battle.GroupId, request.UserId, cancellationToken))
            return Result<BattleResultDto>.Failure("You are not a member of this group.", "NOT_A_MEMBER");
        if (battle.Status != "open")
            return Result<BattleResultDto>.Failure("This battle is closed.", "BATTLE_CLOSED");
        if (battle.Entries.Any(e => e.UserId == request.UserId))
            return Result<BattleResultDto>.Failure("You already played this battle.", "ALREADY_PLAYED");

        var questions = JsonSerializer.Deserialize<List<BattleQuestion>>(battle.QuestionsJson) ?? new List<BattleQuestion>();

        var items = questions.Select(q =>
        {
            var userAnswer = request.Answers.GetValueOrDefault(q.Id, string.Empty);
            var correct = QuizAnswerComparer.IsCorrect(userAnswer, q.CorrectAnswer);
            return new BattleResultItemDto(q.Id, q.Question, q.CorrectAnswer, userAnswer, correct, q.Explanation);
        }).ToList();

        var entry = new QuizBattleEntry
        {
            QuizBattleEntryId = Guid.NewGuid(),
            BattleId = battle.QuizBattleId,
            UserId = request.UserId,
            AnswersJson = JsonSerializer.Serialize(request.Answers),
            Score = items.Count(i => i.Correct),
            Total = items.Count,
            DurationSeconds = Math.Max(0, request.DurationSeconds),
            CompletedAt = DateTime.UtcNow,
        };
        battle.Entries.Add(entry);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Re-read so the returned standings include the new entry with its User loaded.
        var refreshed = await _unitOfWork.QuizBattles.GetByIdWithEntriesAsync(request.BattleId, cancellationToken);
        return Result<BattleResultDto>.Success(new BattleResultDto(
            entry.Score, entry.Total, items, BattleMapper.ToDto(refreshed!, request.UserId)));
    }
}
