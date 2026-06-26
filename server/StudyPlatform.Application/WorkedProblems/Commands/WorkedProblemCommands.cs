using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.WorkedProblems.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.WorkedProblems.Commands;

// ── Generate Worked Problems ──────────────────────────────────────────────────

public record GenerateWorkedProblemsCommand(
    Guid UserId,
    Guid? DocumentId,
    Guid? VideoId,
    string Difficulty,
    int Count) : IRequest<Result<IEnumerable<WorkedProblemDto>>>;

public class GenerateWorkedProblemsCommandHandler : IRequestHandler<GenerateWorkedProblemsCommand, Result<IEnumerable<WorkedProblemDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    private readonly IDocumentTextExtractor _textExtractor;

    public GenerateWorkedProblemsCommandHandler(
        IUnitOfWork unitOfWork,
        IAiService aiService,
        IDocumentTextExtractor textExtractor)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _textExtractor = textExtractor;
    }

    public async Task<Result<IEnumerable<WorkedProblemDto>>> Handle(GenerateWorkedProblemsCommand request, CancellationToken cancellationToken)
    {
        string content = string.Empty;

        if (request.DocumentId.HasValue)
        {
            var doc = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId.Value, cancellationToken);
            if (doc == null || doc.UserId != request.UserId)
                return Result<IEnumerable<WorkedProblemDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");
            content = await _textExtractor.ExtractTextAsync(doc.BlobUrl, doc.ContentType, cancellationToken);
        }
        else if (request.VideoId.HasValue)
        {
            var video = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(request.VideoId.Value, request.UserId, cancellationToken);
            if (video == null)
                return Result<IEnumerable<WorkedProblemDto>>.Failure("Video not found.", "VIDEO_NOT_FOUND");
            content = video.Transcript ?? video.Summary ?? video.Title;
        }

        if (string.IsNullOrWhiteSpace(content))
            return Result<IEnumerable<WorkedProblemDto>>.Failure("No content available to generate problems.", "NO_CONTENT");

        var json = await _aiService.GenerateWorkedProblemsAsync(content, request.Difficulty, request.Count, cancellationToken);

        List<AiProblemItem> items;
        try
        {
            items = JsonSerializer.Deserialize<List<AiProblemItem>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        catch
        {
            items = [];
        }

        var problems = items.Select(i => new WorkedProblem
        {
            WorkedProblemId = Guid.NewGuid(),
            UserId = request.UserId,
            DocumentId = request.DocumentId,
            YouTubeVideoId = request.VideoId,
            ProblemText = i.Problem,
            StepsJson = JsonSerializer.Serialize(i.Steps ?? []),
            FinalAnswer = i.Answer,
            Difficulty = request.Difficulty,
            Topic = i.Topic,
            CreatedAt = DateTime.UtcNow,
        }).ToList();

        await _unitOfWork.WorkedProblems.AddRangeAsync(problems, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<IEnumerable<WorkedProblemDto>>.Success(problems.Select(ToDto));
    }

    internal static WorkedProblemDto ToDto(WorkedProblem p)
    {
        var steps = new List<ProblemStepDto>();
        try
        {
            steps = JsonSerializer.Deserialize<List<ProblemStepDto>>(p.StepsJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        catch { }
        return new WorkedProblemDto(p.WorkedProblemId, p.UserId, p.DocumentId, p.YouTubeVideoId,
            p.ProblemText, steps, p.FinalAnswer, p.Difficulty, p.Topic, p.CreatedAt);
    }

    private record AiStepItem(int StepNumber, string Description, string? Formula);
    private record AiProblemItem(string Problem, List<AiStepItem>? Steps, string Answer, string? Topic);
}

// ── Submit Problem Attempt ────────────────────────────────────────────────────

public record SubmitProblemAttemptCommand(
    Guid UserId,
    Guid ProblemId,
    string UserAnswer) : IRequest<Result<WorkedProblemAttemptDto>>;

public class SubmitProblemAttemptCommandHandler : IRequestHandler<SubmitProblemAttemptCommand, Result<WorkedProblemAttemptDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;

    public SubmitProblemAttemptCommandHandler(IUnitOfWork unitOfWork, IAiService aiService)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
    }

    public async Task<Result<WorkedProblemAttemptDto>> Handle(SubmitProblemAttemptCommand request, CancellationToken cancellationToken)
    {
        var problem = await _unitOfWork.WorkedProblems.GetByIdAsync(request.ProblemId, cancellationToken);
        if (problem == null || problem.UserId != request.UserId)
            return Result<WorkedProblemAttemptDto>.Failure("Problem not found.", "PROBLEM_NOT_FOUND");

        string? aiEvaluation = null;
        bool? isCorrect = null;

        try
        {
            var evalJson = await _aiService.EvaluateProblemAttemptAsync(
                problem.ProblemText, problem.FinalAnswer, request.UserAnswer, cancellationToken);
            var eval = JsonSerializer.Deserialize<EvalResult>(evalJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (eval != null)
            {
                isCorrect = eval.IsCorrect;
                aiEvaluation = eval.Evaluation;
            }
        }
        catch { }

        var attempt = new WorkedProblemAttempt
        {
            WorkedProblemAttemptId = Guid.NewGuid(),
            UserId = request.UserId,
            WorkedProblemId = request.ProblemId,
            UserAnswer = request.UserAnswer,
            AiEvaluation = aiEvaluation,
            IsCorrect = isCorrect,
            AttemptedAt = DateTime.UtcNow,
        };

        await _unitOfWork.WorkedProblemAttempts.AddAsync(attempt, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<WorkedProblemAttemptDto>.Success(new WorkedProblemAttemptDto(
            attempt.WorkedProblemAttemptId, attempt.WorkedProblemId,
            attempt.UserAnswer, attempt.AiEvaluation, attempt.IsCorrect, attempt.AttemptedAt));
    }

    private record EvalResult(bool IsCorrect, string Evaluation);
}
