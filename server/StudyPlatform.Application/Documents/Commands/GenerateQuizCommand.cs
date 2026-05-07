using System.Text.Json;
using System.Text.RegularExpressions;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record GenerateQuizCommand(Guid DocumentId, Guid UserId) : IRequest<Result<IEnumerable<QuizDto>>>;

public class GenerateQuizCommandHandler : IRequestHandler<GenerateQuizCommand, Result<IEnumerable<QuizDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    private readonly IBlobStorageService _blobStorageService;
    private readonly IDocumentTextExtractor _textExtractor;

    public GenerateQuizCommandHandler(
        IUnitOfWork unitOfWork,
        IAiService aiService,
        IBlobStorageService blobStorageService,
        IDocumentTextExtractor textExtractor)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _blobStorageService = blobStorageService;
        _textExtractor = textExtractor;
    }

    public async Task<Result<IEnumerable<QuizDto>>> Handle(GenerateQuizCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<IEnumerable<QuizDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var existing = await _unitOfWork.Quizzes.GetByDocumentIdAsync(request.DocumentId, cancellationToken);
        if (existing.Any())
        {
            var cachedDtos = existing.Select(q => new QuizDto(
                q.QuizId,
                q.DocumentId,
                q.YouTubeVideoId,
                q.SourceType,
                q.Question,
                JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? Array.Empty<string>(),
                q.CorrectAnswer,
                q.Explanation,
                q.CreatedAt));

            return Result<IEnumerable<QuizDto>>.Success(cachedDtos, "Quiz retrieved successfully.");
        }

        string quizJson;

        if (document.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(document.Transcript))
        {
            quizJson = await _aiService.GenerateQuizAsync(document.Transcript, cancellationToken);
        }
        else if (AiInlineData.IsSupported(document.ContentType))
        {
            var stream = await _blobStorageService.DownloadAsync(document.BlobUrl, cancellationToken);
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, cancellationToken);
            quizJson = await _aiService.GenerateQuizAsync(ms.ToArray(), document.ContentType, cancellationToken);
        }
        else
        {
            var text = await _textExtractor.ExtractTextAsync(document.BlobUrl, document.ContentType, cancellationToken);
            quizJson = await _aiService.GenerateQuizAsync(text, cancellationToken);
        }

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
            CreatedAt = DateTime.UtcNow
        }).ToList();

        await _unitOfWork.Quizzes.AddRangeAsync(quizzes, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dtos = quizzes.Select(q => new QuizDto(
            q.QuizId,
            q.DocumentId,
            q.YouTubeVideoId,
            q.SourceType,
            q.Question,
            JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? Array.Empty<string>(),
            q.CorrectAnswer,
            q.Explanation,
            q.CreatedAt));

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

    private record AiQuizItem(string Question, string[] Options, string CorrectAnswer, string Explanation);
}
