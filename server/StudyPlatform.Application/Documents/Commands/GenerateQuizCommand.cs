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

    public GenerateQuizCommandHandler(
        IUnitOfWork unitOfWork,
        IAiService aiService,
        IDocumentContentService contentService)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _contentService = contentService;
    }

    public async Task<Result<IEnumerable<QuizDto>>> Handle(GenerateQuizCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<IEnumerable<QuizDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var difficulty = QuizDifficulty.Normalize(request.Difficulty);
        var existing = await _unitOfWork.Quizzes.GetByDocumentIdAndDifficultyAsync(request.DocumentId, difficulty, cancellationToken);
        if (existing.Any())
        {
            var cachedDtos = existing.Select(q => q.ToQuizDto());

            return Result<IEnumerable<QuizDto>>.Success(cachedDtos, "Quiz retrieved successfully.");
        }

        var (bytes, text) = await _contentService.GetContentAsync(document, cancellationToken);
        var quizJson = bytes != null
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
            Difficulty = difficulty,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        await _unitOfWork.Quizzes.AddRangeAsync(quizzes, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dtos = quizzes.Select(q => q.ToQuizDto());

        return Result<IEnumerable<QuizDto>>.Success(dtos, "Quiz generated successfully.");
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
