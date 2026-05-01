using System.Text.Json;
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

        if (document.ContentType == "audio/podcast")
        {
            quizJson = await _aiService.GenerateQuizAsync(document.Transcript ?? string.Empty, cancellationToken);
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
            CorrectAnswer = q.CorrectAnswer,
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

    private record AiQuizItem(string Question, string[] Options, string CorrectAnswer, string Explanation);
}
