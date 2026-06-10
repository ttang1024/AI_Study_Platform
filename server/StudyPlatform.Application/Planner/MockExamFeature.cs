using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Mistakes;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Planner;

/// <summary>
/// Assembles a timed mock exam by sampling the user's existing quiz questions
/// (optionally restricted to one course). Correct answers stay server-side.
/// </summary>
public record GetMockExamQuery(Guid UserId, Guid? CourseId, int Count) : IRequest<Result<MockExamDto>>;

/// <summary>Grades a mock exam server-side and feeds wrong answers into the mistake notebook.</summary>
public record GradeMockExamCommand(Guid UserId, Dictionary<string, string> Answers, int DurationSeconds)
    : IRequest<Result<MockExamResultDto>>;

public class GetMockExamQueryHandler : IRequestHandler<GetMockExamQuery, Result<MockExamDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetMockExamQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<MockExamDto>> Handle(GetMockExamQuery request, CancellationToken cancellationToken)
    {
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
            return Result<MockExamDto>.Failure("No quiz questions available. Generate quizzes from your materials first.", "NO_QUESTIONS");

        var count = Math.Clamp(request.Count, 3, 50);
        var sampled = quizzes.OrderBy(_ => Random.Shared.Next()).Take(count).ToList();

        var questions = sampled.Select(q => new MockExamQuestionDto(
            q.QuizId, q.Question, ParseOptions(q.OptionsJson))).ToList();

        // Roughly 90 seconds per question, rounded up to the nearest 5 minutes.
        var suggestedMinutes = (int)Math.Ceiling(questions.Count * 1.5 / 5.0) * 5;

        return Result<MockExamDto>.Success(new MockExamDto(request.CourseId, questions, suggestedMinutes));
    }

    private static IReadOnlyList<string> ParseOptions(string optionsJson)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(optionsJson) ?? new List<string>();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }
}

public class GradeMockExamCommandHandler : IRequestHandler<GradeMockExamCommand, Result<MockExamResultDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GradeMockExamCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<MockExamResultDto>> Handle(GradeMockExamCommand request, CancellationToken cancellationToken)
    {
        if (request.Answers.Count == 0)
            return Result<MockExamResultDto>.Failure("No answers submitted.", "NO_ANSWERS");

        var quizIds = request.Answers.Keys
            .Select(k => Guid.TryParse(k, out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .ToList();

        var quizzes = (await _unitOfWork.Quizzes.FindAsync(
            q => q.UserId == request.UserId && quizIds.Contains(q.QuizId), cancellationToken)).ToList();

        var items = new List<MockExamResultItemDto>();
        foreach (var quiz in quizzes)
        {
            var userAnswer = request.Answers.GetValueOrDefault(quiz.QuizId.ToString(), string.Empty);
            var correct = QuizAnswerComparer.IsCorrect(userAnswer, quiz.CorrectAnswer);
            items.Add(new MockExamResultItemDto(
                quiz.QuizId, quiz.Question, quiz.CorrectAnswer, userAnswer, correct, quiz.Explanation));
        }

        await MistakeCapture.CaptureForQuizzesAsync(_unitOfWork, request.UserId, quizzes, request.Answers, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var score = items.Count(i => i.Correct);
        return Result<MockExamResultDto>.Success(new MockExamResultDto(score, items.Count, items));
    }
}
