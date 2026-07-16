using System.Text.Json;
using System.Text.RegularExpressions;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record GenerateQuizCommand(Guid DocumentId, Guid UserId, string Difficulty = "medium") : IRequest<Result<IEnumerable<QuizDto>>>;

public class GenerateQuizCommandHandler : IRequestHandler<GenerateQuizCommand, Result<IEnumerable<QuizDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    private readonly IDocumentContentService _contentService;
    private readonly IAdaptiveQuizPlanner _planner;

    public GenerateQuizCommandHandler(
        IUnitOfWork unitOfWork,
        IAiService aiService,
        IDocumentContentService contentService,
        IAdaptiveQuizPlanner planner)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _contentService = contentService;
        _planner = planner;
    }

    public async Task<Result<IEnumerable<QuizDto>>> Handle(GenerateQuizCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<IEnumerable<QuizDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var isAdaptive = QuizDifficulty.IsAdaptive(request.Difficulty);

        // An adaptive quiz is aimed at the learner's *current* weak spots, so it is regenerated each
        // time rather than served from the stored set — that set was targeted at who they were last
        // week. Only the adaptive quizzes for this document are cleared; a half-finished easy/medium/
        // hard quiz is left alone.
        QuizPlan? plan = null;
        if (isAdaptive)
        {
            plan = await _planner.PlanAsync(request.UserId, request.DocumentId, cancellationToken);
            await ClearPreviousAdaptiveQuizzesAsync(request.DocumentId, cancellationToken);
        }

        var difficulty = isAdaptive ? plan!.Difficulty : QuizDifficulty.Normalize(request.Difficulty);

        if (!isAdaptive)
        {
            var existing = await _unitOfWork.Quizzes.GetByDocumentIdAndDifficultyAsync(request.DocumentId, difficulty, cancellationToken);
            if (existing.Any())
            {
                var cachedDtos = existing.Select(q => q.ToQuizDto());

                return Result<IEnumerable<QuizDto>>.Success(cachedDtos, "Quiz retrieved successfully.");
            }
        }

        var (bytes, text) = await _contentService.GetContentAsync(document, cancellationToken);
        var quizJson = isAdaptive
            ? bytes != null
                ? await _aiService.GenerateAdaptiveQuizAsync(bytes, document.ContentType, plan!, cancellationToken)
                : await _aiService.GenerateAdaptiveQuizAsync(text!, plan!, cancellationToken)
            : bytes != null
                ? await _aiService.GenerateQuizAsync(bytes, document.ContentType, difficulty, cancellationToken)
                : await _aiService.GenerateQuizAsync(text!, difficulty, cancellationToken);

        List<AiQuizItem> quizItems;
        try
        {
            quizItems = JsonSerializer.Deserialize<List<AiQuizItem>>(quizJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<AiQuizItem>();
        }
        catch (JsonException)
        {
            return Result<IEnumerable<QuizDto>>.Failure("AI returned an unexpected response format. Please try again.", "PARSE_ERROR");
        }

        var quizzes = quizItems.Select(q => new Quiz
        {
            QuizId = Guid.NewGuid(),
            DocumentId = request.DocumentId,
            SourceType = "document",
            UserId = request.UserId,
            Question = q.Question,
            OptionsJson = JsonSerializer.Serialize(q.Options),
            CorrectAnswer = NormalizeCorrectAnswer(q.Options, q.CorrectAnswer),
            Explanation = q.Explanation,
            // Adaptive quizzes are stored under their own key rather than the difficulty they resolved
            // to, so that clearing them can't take a regular easy/medium/hard quiz down with it, and so
            // that asking for "hard" never silently serves a quiz built for someone else's weak spots.
            Difficulty = isAdaptive ? QuizDifficulty.Adaptive : difficulty,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        await _unitOfWork.Quizzes.AddRangeAsync(quizzes, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dtos = quizzes.Select(q => q.ToQuizDto());

        return Result<IEnumerable<QuizDto>>.Success(dtos, isAdaptive ? plan!.Rationale : "Quiz generated successfully.");
    }

    /// <summary>Drops the previous adaptive quiz for this document. Regular quizzes are untouched.</summary>
    private async Task ClearPreviousAdaptiveQuizzesAsync(Guid documentId, CancellationToken cancellationToken)
    {
        var previous = await _unitOfWork.Quizzes.GetByDocumentIdAndDifficultyAsync(
            documentId, QuizDifficulty.Adaptive, cancellationToken);

        var stale = previous.ToList();
        if (stale.Count == 0)
            return;

        _unitOfWork.Quizzes.RemoveRange(stale);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static string NormalizeCorrectAnswer(string[] options, string correctAnswer)
    {
        var trimmed = correctAnswer.Trim();
        if (Regex.IsMatch(trimmed, "^[A-D]$", RegexOptions.IgnoreCase))
            return trimmed.ToUpperInvariant();

        for (var i = 0; i < options.Length && i < 4; i++)
        {
            if (AnswersMatch(options[i], trimmed))
                return ((char)('A' + i)).ToString();
        }

        return trimmed;
    }

    private static bool AnswersMatch(string option, string answer)
    {
        if (string.Equals(NormalizeText(option), NormalizeText(answer), StringComparison.OrdinalIgnoreCase))
            return true;

        return string.Equals(NormalizeMeaning(option), NormalizeMeaning(answer), StringComparison.OrdinalIgnoreCase);
    }

    private static string StripOptionPrefix(string value)
        => Regex.Replace(value.Trim(), "^[A-D][).:\\s]+", string.Empty, RegexOptions.IgnoreCase).Trim();

    private static string NormalizeText(string value)
        => Regex.Replace(StripOptionPrefix(value), "\\s+", " ").Trim().ToLowerInvariant();

    private static string NormalizeMeaning(string value)
    {
        var stripped = StripOptionPrefix(value).ToLowerInvariant().Replace("&", " and ");
        var withoutAnd = Regex.Replace(stripped, "\\band\\b", " ");
        var alphanumeric = Regex.Replace(withoutAnd, "[^a-z0-9]+", " ");
        return Regex.Replace(alphanumeric, "\\s+", " ").Trim();
    }

}
