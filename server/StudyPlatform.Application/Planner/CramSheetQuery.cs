using System.Text;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Planner;

public record CramSheetDto(Guid ExamPlanId, string Title, DateTime ExamDate, string Markdown, DateTime GeneratedAt);

/// <summary>
/// Exam cram mode: an AI-written one-page cheat sheet for an exam plan, built from
/// what the learner is demonstrably weak on — open mistake-notebook entries and
/// unmastered glossary terms, scoped to the plan's course. Cached for a day per
/// plan; pass <c>Refresh</c> to regenerate.
/// </summary>
public record GetCramSheetQuery(Guid UserId, Guid ExamPlanId, bool Refresh = false) : IRequest<Result<CramSheetDto>>;

public class GetCramSheetQueryHandler : IRequestHandler<GetCramSheetQuery, Result<CramSheetDto>>
{
    private const int MaxMistakes = 15;
    private const int MaxTerms = 40;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(24);

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    private readonly IAppCache _cache;

    public GetCramSheetQueryHandler(IUnitOfWork unitOfWork, IAiService aiService, IAppCache cache)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _cache = cache;
    }

    public async Task<Result<CramSheetDto>> Handle(GetCramSheetQuery request, CancellationToken ct)
    {
        var plan = (await _unitOfWork.ExamPlans.FindAsNoTrackingAsync(
            p => p.ExamPlanId == request.ExamPlanId && p.UserId == request.UserId, ct)).FirstOrDefault();
        if (plan is null)
            return Result<CramSheetDto>.Failure("Exam plan not found.", "PLAN_NOT_FOUND");

        var cacheKey = $"cram-sheet:{request.UserId}:{request.ExamPlanId}";
        if (!request.Refresh)
        {
            var cached = await _cache.GetAsync<CramSheetDto>(cacheKey, ct);
            if (cached is not null)
                return Result<CramSheetDto>.Success(cached);
        }

        // Course scoping: material belongs to the plan's course via its source doc/video.
        var userId = request.UserId;
        var documents = (await _unitOfWork.Documents.FindAsNoTrackingAsync(d => d.UserId == userId, ct)).ToList();
        var videos = (await _unitOfWork.Videos.FindAsNoTrackingAsync(v => v.UserId == userId, ct)).ToList();
        var docToCourse = documents.ToDictionary(d => d.DocumentId, d => d.CourseId);
        var videoToCourse = videos.ToDictionary(v => v.VideoId, v => v.CourseId);

        bool InCourse(Guid? docId, Guid? videoId)
        {
            if (!plan.CourseId.HasValue) return true;
            if (docId.HasValue && docToCourse.TryGetValue(docId.Value, out var c1)) return c1 == plan.CourseId;
            if (videoId.HasValue && videoToCourse.TryGetValue(videoId.Value, out var c2)) return c2 == plan.CourseId;
            return false;
        }

        var mistakes = (await _unitOfWork.MistakeEntries.FindAsNoTrackingAsync(
                m => m.UserId == userId && m.Status == "open", ct))
            .Where(m => InCourse(m.DocumentId, m.VideoId))
            .OrderByDescending(m => m.TimesMissed)
            .Take(MaxMistakes)
            .ToList();

        var masteredTerms = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, ct)).ToHashSet();
        var weakTerms = (await _unitOfWork.GlossaryTerms.GetByUserWithSourcesAsync(userId, ct))
            .Where(t => !masteredTerms.Contains(t.GlossaryTermId)
                && InCourse(t.DocumentId, t.VideoId)
                && !string.IsNullOrWhiteSpace(t.Term)
                && !string.IsNullOrWhiteSpace(t.Definition))
            .Take(MaxTerms)
            .ToList();

        if (mistakes.Count == 0 && weakTerms.Count == 0)
            return Result<CramSheetDto>.Failure(
                "Nothing to cram — no open mistakes or unmastered terms for this exam's scope.", "NO_WEAK_MATERIAL");

        var daysLeft = Math.Max(0, (int)Math.Ceiling((plan.ExamDate.Date - DateTime.UtcNow.Date).TotalDays));
        var prompt = BuildPrompt(plan.Title, daysLeft, weakTerms.Select(t => (t.Term, t.Definition)), mistakes.Select(m => (m.Question, m.CorrectAnswer)));

        var markdown = await _aiService.GeneralChatAsync(Array.Empty<(string, string)>(), prompt, ct);
        var dto = new CramSheetDto(plan.ExamPlanId, plan.Title, plan.ExamDate, markdown.Trim(), DateTime.UtcNow);

        await _cache.SetAsync(cacheKey, dto, CacheTtl, ct);
        return Result<CramSheetDto>.Success(dto);
    }

    private static string BuildPrompt(
        string examTitle,
        int daysLeft,
        IEnumerable<(string Term, string Definition)> weakTerms,
        IEnumerable<(string Question, string Answer)> mistakes)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"You are a study coach. The learner has an exam \"{examTitle}\" in {daysLeft} day(s).");
        sb.AppendLine("Write a ONE-PAGE cram sheet in Markdown, built ONLY from the weak material below. Requirements:");
        sb.AppendLine("- Start with a two-sentence pep-talk summary of what to focus on.");
        sb.AppendLine("- \"## Key concepts\": the weak terms grouped by theme, each with a one-line memorable definition.");
        sb.AppendLine("- \"## Watch out\": for each previously-missed question, one bullet naming the trap and the right idea (do not repeat the full question).");
        sb.AppendLine("- \"## Final checklist\": 3-5 concrete things to review in the last 24 hours.");
        sb.AppendLine("- Be terse. No preamble, no closing remarks, Markdown only.");
        sb.AppendLine();
        sb.AppendLine("Weak terms (term — definition):");
        foreach (var (term, definition) in weakTerms)
            sb.AppendLine($"- {term} — {definition}");
        sb.AppendLine();
        sb.AppendLine("Previously missed questions (question | correct answer):");
        foreach (var (question, answer) in mistakes)
            sb.AppendLine($"- {question} | {answer}");
        return sb.ToString();
    }
}
