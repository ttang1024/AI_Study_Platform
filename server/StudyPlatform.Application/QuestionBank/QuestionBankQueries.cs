using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;

namespace StudyPlatform.Application.QuestionBank;

public record GetQuestionBankQuery(Guid UserId, Guid? CourseId = null, string? SourceType = null, string? Difficulty = null)
    : IRequest<Result<IEnumerable<QuestionBankQuestionDto>>>;

public class GetQuestionBankQueryHandler : IRequestHandler<GetQuestionBankQuery, Result<IEnumerable<QuestionBankQuestionDto>>>
{
    private readonly ICourseRepository _courses;
    private readonly IDocumentRepository _documents;
    private readonly IQuizRepository _quizzes;
    private readonly IVideoRepository _videos;

    public GetQuestionBankQueryHandler(ICourseRepository courses, IDocumentRepository documents, IQuizRepository quizzes, IVideoRepository videos)
    {
        _courses = courses;
        _documents = documents;
        _quizzes = quizzes;
        _videos = videos;
    }

    public async Task<Result<IEnumerable<QuestionBankQuestionDto>>> Handle(GetQuestionBankQuery request, CancellationToken cancellationToken)
    {
        var quizzes = (await _quizzes.FindAsNoTrackingAsync(q =>
                q.UserId == request.UserId &&
                (request.SourceType == null || q.SourceType == request.SourceType) &&
                (request.Difficulty == null || q.Difficulty == request.Difficulty),
                cancellationToken))
            .ToList();

        var documents = (await _documents.GetSourceCoursesByUserAsync(request.UserId, cancellationToken))
            .ToDictionary(d => d.Id);
        var videos = (await _videos.GetSourceCoursesByUserAsync(request.UserId, cancellationToken))
            .ToDictionary(v => v.Id);
        var courses = (await _courses.FindAsNoTrackingAsync(c => c.UserId == request.UserId, cancellationToken))
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
        IReadOnlyDictionary<Guid, SourceCourse> documents,
        IReadOnlyDictionary<Guid, SourceCourse> videos,
        IReadOnlyDictionary<Guid, Course> courses)
    {
        Guid? courseId = null;
        string? sourceName = null;
        if (quiz.DocumentId.HasValue && documents.TryGetValue(quiz.DocumentId.Value, out var document))
        {
            courseId = document.CourseId;
            sourceName = document.Name;
        }
        else if (quiz.VideoId.HasValue && videos.TryGetValue(quiz.VideoId.Value, out var video))
        {
            courseId = video.CourseId;
            sourceName = video.Name;
        }

        courses.TryGetValue(courseId ?? Guid.Empty, out var course);

        return new QuestionBankQuestionDto(
            quiz.QuizId,
            quiz.DocumentId,
            quiz.VideoId,
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
