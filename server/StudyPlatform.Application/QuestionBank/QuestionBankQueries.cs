using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.QuestionBank;

public record GetQuestionBankQuery(Guid UserId, Guid? CourseId = null, string? SourceType = null, string? Difficulty = null)
    : IRequest<Result<IEnumerable<QuestionBankQuestionDto>>>;

public class GetQuestionBankQueryHandler : IRequestHandler<GetQuestionBankQuery, Result<IEnumerable<QuestionBankQuestionDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetQuestionBankQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IEnumerable<QuestionBankQuestionDto>>> Handle(GetQuestionBankQuery request, CancellationToken cancellationToken)
    {
        var quizzes = (await _unitOfWork.Quizzes.FindAsync(q =>
                q.UserId == request.UserId &&
                (request.SourceType == null || q.SourceType == request.SourceType) &&
                (request.Difficulty == null || q.Difficulty == request.Difficulty),
                cancellationToken))
            .ToList();

        var documents = (await _unitOfWork.Documents.FindAsync(d => d.UserId == request.UserId, cancellationToken))
            .ToDictionary(d => d.DocumentId);
        var videos = (await _unitOfWork.YouTubeVideos.FindAsync(v => v.UserId == request.UserId, cancellationToken))
            .ToDictionary(v => v.YouTubeVideoId);
        var courses = (await _unitOfWork.Courses.FindAsync(c => c.UserId == request.UserId, cancellationToken))
            .ToDictionary(c => c.CourseId);

        var dtos = quizzes
            .Select(q => ToDto(q, documents, videos, courses))
            .Where(q => request.CourseId == null || q.CourseId == request.CourseId)
            .OrderByDescending(q => q.CreatedAt)
            .ToList();

        return Result<IEnumerable<QuestionBankQuestionDto>>.Success(dtos);
    }

    internal static QuestionBankQuestionDto ToDto(
        Quiz quiz,
        IReadOnlyDictionary<Guid, Document> documents,
        IReadOnlyDictionary<Guid, YouTubeVideo> videos,
        IReadOnlyDictionary<Guid, Course> courses)
    {
        Guid? courseId = null;
        string? sourceName = null;
        if (quiz.DocumentId.HasValue && documents.TryGetValue(quiz.DocumentId.Value, out var document))
        {
            courseId = document.CourseId;
            sourceName = document.FileName;
        }
        else if (quiz.YouTubeVideoId.HasValue && videos.TryGetValue(quiz.YouTubeVideoId.Value, out var video))
        {
            courseId = video.CourseId;
            sourceName = video.Title;
        }

        courses.TryGetValue(courseId ?? Guid.Empty, out var course);

        return new QuestionBankQuestionDto(
            quiz.QuizId,
            quiz.DocumentId,
            quiz.YouTubeVideoId,
            courseId,
            quiz.SourceType,
            sourceName,
            course?.CourseName,
            course?.CourseColor,
            quiz.Question,
            JsonSerializer.Deserialize<string[]>(quiz.OptionsJson) ?? Array.Empty<string>(),
            quiz.CorrectAnswer,
            quiz.Explanation,
            quiz.Difficulty,
            quiz.CreatedAt);
    }
}
