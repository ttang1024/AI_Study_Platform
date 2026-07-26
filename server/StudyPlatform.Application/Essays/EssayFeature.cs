using System.Text.Json;
using FluentValidation;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Essays;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record RubricCriterionDto(string Name, string? Description, double MaxPoints);

public record RubricDto(
    Guid RubricId,
    string Name,
    string? Description,
    IEnumerable<RubricCriterionDto> Criteria,
    double TotalPoints,
    DateTime UpdatedAt);

public record EssaySubmissionDto(
    Guid EssaySubmissionId,
    Guid? RubricId,
    string? RubricName,
    string Title,
    string? PromptText,
    string Text,
    int WordCount,
    int Version,
    Guid? ParentSubmissionId,
    JsonElement? Feedback,
    double? ScorePercent,
    DateTime? GradedAt,
    DateTime CreatedAt);

// ── Mapping ─────────────────────────────────────────────────────────────────

internal static class EssayMappings
{
    public static RubricDto ToDto(this Rubric r)
    {
        var criteria = ParseCriteria(r.CriteriaJson);
        return new RubricDto(
            r.RubricId, r.Name, r.Description, criteria, criteria.Sum(c => c.MaxPoints), r.UpdatedAt);
    }

    /// <summary>Tolerates a malformed rubric rather than throwing — an unreadable scheme should
    /// render as empty, not take the whole page down.</summary>
    public static List<RubricCriterionDto> ParseCriteria(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<RubricCriterionDto>>(
                json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
        }
        catch (JsonException)
        {
            return new();
        }
    }

    public static EssaySubmissionDto ToDto(this EssaySubmission e, string? rubricName = null)
    {
        JsonElement? feedback = null;
        if (!string.IsNullOrWhiteSpace(e.FeedbackJson))
        {
            try
            {
                feedback = JsonDocument.Parse(e.FeedbackJson).RootElement.Clone();
            }
            catch (JsonException)
            {
                feedback = null;
            }
        }

        return new EssaySubmissionDto(
            e.EssaySubmissionId, e.RubricId, rubricName, e.Title, e.PromptText, e.Text,
            e.WordCount, e.Version, e.ParentSubmissionId, feedback, e.ScorePercent, e.GradedAt, e.CreatedAt);
    }

    public static int CountWords(string text) =>
        text.Split(new[] { ' ', '\t', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries).Length;
}

// ── Rubric queries and commands ─────────────────────────────────────────────

public record GetRubricsQuery(Guid UserId) : IRequest<Result<IEnumerable<RubricDto>>>;

public class GetRubricsQueryHandler : IRequestHandler<GetRubricsQuery, Result<IEnumerable<RubricDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetRubricsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<RubricDto>>> Handle(
        GetRubricsQuery request, CancellationToken cancellationToken)
    {
        var rubrics = await _unitOfWork.Rubrics.GetByUserAsync(request.UserId, cancellationToken);
        return Result<IEnumerable<RubricDto>>.Success(rubrics.Select(r => r.ToDto()));
    }
}

public record SaveRubricCommand(
    Guid UserId,
    Guid? RubricId,
    string Name,
    string? Description,
    IEnumerable<RubricCriterionDto> Criteria) : IRequest<Result<RubricDto>>;

public class SaveRubricCommandValidator : AbstractValidator<SaveRubricCommand>
{
    public SaveRubricCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Criteria).NotEmpty().WithMessage("A rubric needs at least one criterion.");
        RuleForEach(x => x.Criteria).ChildRules(c =>
        {
            c.RuleFor(x => x.Name).NotEmpty();
            c.RuleFor(x => x.MaxPoints).GreaterThan(0).WithMessage("Each criterion must be worth more than zero.");
        });
    }
}

public class SaveRubricCommandHandler : IRequestHandler<SaveRubricCommand, Result<RubricDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public SaveRubricCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<RubricDto>> Handle(SaveRubricCommand request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var criteriaJson = JsonSerializer.Serialize(request.Criteria);

        Rubric rubric;
        if (request.RubricId is { } id)
        {
            var existing = await _unitOfWork.Rubrics.FirstOrDefaultAsync(
                r => r.RubricId == id && r.UserId == request.UserId, cancellationToken);
            if (existing == null)
                return Result<RubricDto>.Failure("Rubric not found.", "NOT_FOUND");

            existing.Name = request.Name.Trim();
            existing.Description = request.Description?.Trim();
            existing.CriteriaJson = criteriaJson;
            existing.UpdatedAt = now;
            _unitOfWork.Rubrics.Update(existing);
            rubric = existing;
        }
        else
        {
            rubric = new Rubric
            {
                RubricId = Guid.NewGuid(),
                UserId = request.UserId,
                Name = request.Name.Trim(),
                Description = request.Description?.Trim(),
                CriteriaJson = criteriaJson,
                CreatedAt = now,
                UpdatedAt = now,
            };
            await _unitOfWork.Rubrics.AddAsync(rubric, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<RubricDto>.Success(rubric.ToDto(), "Rubric saved.");
    }
}

public record DeleteRubricCommand(Guid UserId, Guid RubricId) : IRequest<Result<bool>>;

public class DeleteRubricCommandHandler : IRequestHandler<DeleteRubricCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    public DeleteRubricCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<bool>> Handle(DeleteRubricCommand request, CancellationToken cancellationToken)
    {
        var rubric = await _unitOfWork.Rubrics.FirstOrDefaultAsync(
            r => r.RubricId == request.RubricId && r.UserId == request.UserId, cancellationToken);
        if (rubric == null)
            return Result<bool>.Failure("Rubric not found.", "NOT_FOUND");

        // Submissions graded against it keep their feedback; the FK is SetNull, not Cascade.
        _unitOfWork.Rubrics.Remove(rubric);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Rubric deleted.");
    }
}

// ── Submission queries and commands ─────────────────────────────────────────

public record GetEssaysQuery(Guid UserId) : IRequest<Result<IEnumerable<EssaySubmissionDto>>>;

public class GetEssaysQueryHandler : IRequestHandler<GetEssaysQuery, Result<IEnumerable<EssaySubmissionDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetEssaysQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<EssaySubmissionDto>>> Handle(
        GetEssaysQuery request, CancellationToken cancellationToken)
    {
        var essays = (await _unitOfWork.EssaySubmissions.GetLatestByUserAsync(request.UserId, cancellationToken)).ToList();
        var rubricNames = await RubricNamesAsync(_unitOfWork, request.UserId, cancellationToken);

        return Result<IEnumerable<EssaySubmissionDto>>.Success(
            essays.Select(e => e.ToDto(e.RubricId is { } id ? rubricNames.GetValueOrDefault(id) : null)));
    }

    internal static async Task<Dictionary<Guid, string>> RubricNamesAsync(
        IUnitOfWork unitOfWork, Guid userId, CancellationToken cancellationToken)
    {
        var rubrics = await unitOfWork.Rubrics.GetByUserAsync(userId, cancellationToken);
        return rubrics.ToDictionary(r => r.RubricId, r => r.Name);
    }
}

public record GetEssayChainQuery(Guid UserId, Guid SubmissionId) : IRequest<Result<IEnumerable<EssaySubmissionDto>>>;

public class GetEssayChainQueryHandler : IRequestHandler<GetEssayChainQuery, Result<IEnumerable<EssaySubmissionDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetEssayChainQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<EssaySubmissionDto>>> Handle(
        GetEssayChainQuery request, CancellationToken cancellationToken)
    {
        var chain = (await _unitOfWork.EssaySubmissions
            .GetRevisionChainAsync(request.UserId, request.SubmissionId, cancellationToken)).ToList();

        if (chain.Count == 0)
            return Result<IEnumerable<EssaySubmissionDto>>.Failure("Essay not found.", "NOT_FOUND");

        var rubricNames = await GetEssaysQueryHandler.RubricNamesAsync(_unitOfWork, request.UserId, cancellationToken);

        return Result<IEnumerable<EssaySubmissionDto>>.Success(
            chain.Select(e => e.ToDto(e.RubricId is { } id ? rubricNames.GetValueOrDefault(id) : null)));
    }
}

/// <summary>
/// Saves a draft. <paramref name="ParentSubmissionId"/> makes it a revision of an existing one,
/// which is how the before/after comparison stays possible.
/// </summary>
public record SaveEssayCommand(
    Guid UserId,
    Guid? RubricId,
    Guid? ParentSubmissionId,
    string Title,
    string? PromptText,
    string Text) : IRequest<Result<EssaySubmissionDto>>;

public class SaveEssayCommandValidator : AbstractValidator<SaveEssayCommand>
{
    public SaveEssayCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Text).NotEmpty().WithMessage("There is nothing to submit.");
    }
}

public class SaveEssayCommandHandler : IRequestHandler<SaveEssayCommand, Result<EssaySubmissionDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public SaveEssayCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<EssaySubmissionDto>> Handle(
        SaveEssayCommand request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var version = 1;
        var rubricId = request.RubricId;

        if (request.ParentSubmissionId is { } parentId)
        {
            var parent = await _unitOfWork.EssaySubmissions.FirstOrDefaultAsync(
                e => e.EssaySubmissionId == parentId && e.UserId == request.UserId, cancellationToken);
            if (parent == null)
                return Result<EssaySubmissionDto>.Failure("The draft being revised was not found.", "NOT_FOUND");

            version = parent.Version + 1;

            // A revision inherits the parent's rubric unless the caller overrides it — re-marking a
            // draft against a different scheme would make the comparison meaningless.
            rubricId ??= parent.RubricId;
        }

        var essay = new EssaySubmission
        {
            EssaySubmissionId = Guid.NewGuid(),
            UserId = request.UserId,
            RubricId = rubricId,
            ParentSubmissionId = request.ParentSubmissionId,
            Title = request.Title.Trim(),
            PromptText = request.PromptText?.Trim(),
            Text = request.Text,
            WordCount = EssayMappings.CountWords(request.Text),
            Version = version,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await _unitOfWork.EssaySubmissions.AddAsync(essay, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<EssaySubmissionDto>.Success(essay.ToDto(), "Draft saved.");
    }
}

public record GradeEssayCommand(Guid UserId, Guid SubmissionId) : IRequest<Result<EssaySubmissionDto>>;

public class GradeEssayCommandHandler : IRequestHandler<GradeEssayCommand, Result<EssaySubmissionDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;

    public GradeEssayCommandHandler(IUnitOfWork unitOfWork, IAiService aiService)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
    }

    public async Task<Result<EssaySubmissionDto>> Handle(
        GradeEssayCommand request, CancellationToken cancellationToken)
    {
        var essay = await _unitOfWork.EssaySubmissions.FirstOrDefaultAsync(
            e => e.EssaySubmissionId == request.SubmissionId && e.UserId == request.UserId, cancellationToken);
        if (essay == null)
            return Result<EssaySubmissionDto>.Failure("Essay not found.", "NOT_FOUND");

        if (essay.RubricId is not { } rubricId)
            return Result<EssaySubmissionDto>.Failure(
                "Choose a rubric before grading this draft.", "NO_RUBRIC");

        var rubric = await _unitOfWork.Rubrics.FirstOrDefaultAsync(
            r => r.RubricId == rubricId && r.UserId == request.UserId, cancellationToken);
        if (rubric == null)
            return Result<EssaySubmissionDto>.Failure("The rubric for this draft no longer exists.", "NOT_FOUND");

        var json = await _aiService.GradeEssayAsync(
            rubric.CriteriaJson, essay.PromptText, essay.Text, cancellationToken);

        var score = ScoreFromFeedback(json, rubric.CriteriaJson);
        if (score == null)
            return Result<EssaySubmissionDto>.Failure(
                "The grader returned an unexpected response. Please try again.", "PARSE_ERROR");

        essay.FeedbackJson = json;
        essay.ScorePercent = score;
        essay.GradedAt = DateTime.UtcNow;
        essay.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.EssaySubmissions.Update(essay);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<EssaySubmissionDto>.Success(essay.ToDto(rubric.Name), "Marked.");
    }

    /// <summary>
    /// Totals the per-criterion scores rather than trusting any overall figure the model reports.
    ///
    /// <para>Models routinely return an overall score that does not match their own criterion
    /// breakdown — the two are generated independently and the arithmetic is not checked. The
    /// breakdown is what the user can see and argue with, so it is the one that counts.</para>
    ///
    /// <para>Each criterion is also clamped to its own maxPoints, because a model that awards 9/5
    /// would otherwise push the total above 100%.</para>
    /// </summary>
    internal static double? ScoreFromFeedback(string feedbackJson, string criteriaJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(feedbackJson);
            if (!doc.RootElement.TryGetProperty("criteria", out var criteria)
                || criteria.ValueKind != JsonValueKind.Array)
                return null;

            double earned = 0;
            double possible = 0;

            foreach (var criterion in criteria.EnumerateArray())
            {
                if (!criterion.TryGetProperty("score", out var scoreEl)
                    || !scoreEl.TryGetDouble(out var score))
                    continue;

                var max = criterion.TryGetProperty("maxPoints", out var maxEl) && maxEl.TryGetDouble(out var m)
                    ? m
                    : 0;

                if (max <= 0) continue;

                earned += Math.Clamp(score, 0, max);
                possible += max;
            }

            if (possible <= 0) return null;

            return Math.Round(100 * earned / possible, 1);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
