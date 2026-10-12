using System.Text.Json;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Mistakes;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents;

/// <inheritdoc cref="IQuizSubmissionWriter"/>
public class QuizSubmissionWriter : IQuizSubmissionWriter
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IQuizRepository _quizzes;
    private readonly IQuizSubmissionRepository _quizSubmissions;
    private readonly IMistakeEntryRepository _mistakeEntries;

    public QuizSubmissionWriter(IUnitOfWork unitOfWork, IQuizRepository quizzes, IQuizSubmissionRepository quizSubmissions, IMistakeEntryRepository mistakeEntries)
    {
        _unitOfWork = unitOfWork;
        _quizzes = quizzes;
        _quizSubmissions = quizSubmissions;
        _mistakeEntries = mistakeEntries;
    }

    public async Task<QuizSubmissionDto> UpsertAsync(
        Guid userId,
        QuizSource source,
        Dictionary<string, string> answers,
        int score,
        int total,
        Dictionary<string, int>? confidence,
        CancellationToken cancellationToken = default)
    {
        var existing = source.VideoId is { } videoId
            ? await _quizSubmissions.GetByVideoAndUserAsync(videoId, userId, cancellationToken)
            : await _quizSubmissions.GetByDocumentAndUserAsync(source.DocumentId!.Value, userId, cancellationToken);

        var answersJson = JsonSerializer.Serialize(answers);
        var confidenceJson = ConfidenceSerializer.Serialize(confidence);

        if (existing != null)
        {
            // A retake replaces the attempt rather than appending one: the UI shows a single result
            // per material, so a second row would just be unreachable history.
            existing.AnswersJson = answersJson;
            existing.ConfidenceJson = confidenceJson;
            existing.Score = score;
            existing.Total = total;
            existing.SubmittedAt = DateTime.UtcNow;
            _quizSubmissions.Update(existing);
        }
        else
        {
            existing = new QuizSubmission
            {
                SubmissionId = Guid.NewGuid(),
                DocumentId = source.DocumentId,
                VideoId = source.VideoId,
                SourceType = source.SourceType,
                UserId = userId,
                AnswersJson = answersJson,
                ConfidenceJson = confidenceJson,
                Score = score,
                Total = total,
                SubmittedAt = DateTime.UtcNow,
            };
            await _quizSubmissions.AddAsync(existing, cancellationToken);
        }

        await MistakeCapture.CaptureAsync(
            _quizzes, _mistakeEntries, userId, source.SourceType, source.DocumentId, source.VideoId, answers, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return existing.ToQuizSubmissionDto();
    }
}
