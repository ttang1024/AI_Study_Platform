using System.Text.Json;
using System.Text.Json.Serialization;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Application.Practice;

// ── DTOs ──────────────────────────────────────────────────────────────────────

/// <param name="Verdict">"correct", "incorrect", "consequent" (follows correctly from an earlier error) or "unclear".</param>
public record GradedStepDto(int Step, string Text, string Verdict, string Comment);

/// <param name="FirstErrorStep">1-based index of the first genuine mistake. Null when the work is sound throughout.</param>
/// <param name="CorrectedStep">What that step should have been. Null when there is no mistake.</param>
public record HandwritingGradeDto(
    string Problem,
    string Transcription,
    bool IsCorrect,
    int? FirstErrorStep,
    IReadOnlyList<GradedStepDto> Steps,
    string? CorrectedStep,
    string Summary,
    IReadOnlyList<string> Concepts);

// ── Command ───────────────────────────────────────────────────────────────────

/// <summary>
/// Grades a photo of handwritten work. Pages are graded together as one continuous solution, so a
/// derivation that runs over the page break is still read as a single argument.
/// </summary>
public record GradeHandwrittenWorkCommand(
    Guid UserId,
    IReadOnlyList<(byte[] Data, string MimeType)> Pages,
    string? ProblemStatement) : IRequest<Result<HandwritingGradeDto>>;

public class GradeHandwrittenWorkCommandHandler
    : IRequestHandler<GradeHandwrittenWorkCommand, Result<HandwritingGradeDto>>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    private readonly IAiService _aiService;

    public GradeHandwrittenWorkCommandHandler(IAiService aiService) => _aiService = aiService;

    public async Task<Result<HandwritingGradeDto>> Handle(
        GradeHandwrittenWorkCommand request, CancellationToken cancellationToken)
    {
        if (request.Pages.Count == 0)
            return Result<HandwritingGradeDto>.Failure("At least one photo of the work is required.", "NO_PAGES");

        var pages = request.Pages.Select(p => (p.Data, p.MimeType)).ToList();
        var json = await _aiService.GradeHandwrittenWorkAsync(pages, request.ProblemStatement, cancellationToken);

        AiHandwritingGrade? grade;
        try
        {
            grade = JsonSerializer.Deserialize<AiHandwritingGrade>(json, JsonOptions);
        }
        catch (JsonException)
        {
            return Result<HandwritingGradeDto>.Failure(
                "AI returned an unexpected response format. Please try again.", "PARSE_ERROR");
        }

        if (grade == null || string.IsNullOrWhiteSpace(grade.Summary))
            return Result<HandwritingGradeDto>.Failure(
                "The work could not be read. Try a sharper, better-lit photo.", "UNREADABLE");

        var steps = (grade.Steps ?? [])
            .Select((s, i) => new GradedStepDto(
                s.Step > 0 ? s.Step : i + 1,
                s.Text ?? string.Empty,
                NormalizeVerdict(s.Verdict),
                s.Comment ?? string.Empty))
            .ToList();

        return Result<HandwritingGradeDto>.Success(new HandwritingGradeDto(
            grade.Problem ?? string.Empty,
            grade.Transcription ?? string.Empty,
            grade.IsCorrect,
            // Trust the steps over the model's own index: a firstErrorStep pointing at a step it graded
            // "correct" is self-contradictory, and the steps are what the UI actually highlights.
            ResolveFirstErrorStep(grade.FirstErrorStep, steps),
            steps,
            grade.CorrectedStep,
            grade.Summary,
            grade.Concepts ?? []));
    }

    private static int? ResolveFirstErrorStep(int? claimed, IReadOnlyList<GradedStepDto> steps)
    {
        var firstIncorrect = steps.FirstOrDefault(s => s.Verdict == "incorrect");
        if (firstIncorrect != null)
            return firstIncorrect.Step;

        // No step was graded incorrect, so any claimed error index is spurious.
        return steps.Count > 0 ? null : claimed;
    }

    private static string NormalizeVerdict(string? verdict) => verdict?.ToLowerInvariant() switch
    {
        "correct" => "correct",
        "incorrect" => "incorrect",
        "consequent" => "consequent",
        _ => "unclear",
    };

    private sealed record AiHandwritingGrade(
        string? Problem,
        string? Transcription,
        bool IsCorrect,
        int? FirstErrorStep,
        List<AiGradedStep>? Steps,
        string? CorrectedStep,
        string? Summary,
        List<string>? Concepts);

    private sealed record AiGradedStep(int Step, string? Text, string? Verdict, string? Comment);
}
