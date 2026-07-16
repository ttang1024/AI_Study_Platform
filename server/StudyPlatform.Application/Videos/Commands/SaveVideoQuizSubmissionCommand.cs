using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Mistakes;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Commands;

/// <param name="Confidence">
/// Optional {quizId: 1|2|3} self-rating per answer. Absent when the learner skipped the rating or the
/// client does not collect it, which is why it is stored separately rather than folded into Answers.
/// </param>
public record SaveVideoQuizSubmissionCommand(
    Guid VideoId,
    Guid UserId,
    Dictionary<string, string> Answers,
    int Score,
    int Total,
    Dictionary<string, int>? Confidence = null) : IRequest<Result<QuizSubmissionDto>>;

public class SaveVideoQuizSubmissionCommandHandler : IRequestHandler<SaveVideoQuizSubmissionCommand, Result<QuizSubmissionDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public SaveVideoQuizSubmissionCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<QuizSubmissionDto>> Handle(SaveVideoQuizSubmissionCommand request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.Videos.GetByIdForUserAsync(request.VideoId, request.UserId, cancellationToken);
        if (video is null)
            return Result<QuizSubmissionDto>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        var existing = await _unitOfWork.QuizSubmissions.GetByVideoAndUserAsync(request.VideoId, request.UserId, cancellationToken);

        var answersJson = JsonSerializer.Serialize(request.Answers);
        var confidenceJson = ConfidenceSerializer.Serialize(request.Confidence);

        if (existing != null)
        {
            existing.AnswersJson = answersJson;
            existing.ConfidenceJson = confidenceJson;
            existing.Score = request.Score;
            existing.Total = request.Total;
            existing.SubmittedAt = DateTime.UtcNow;
            _unitOfWork.QuizSubmissions.Update(existing);
        }
        else
        {
            existing = new QuizSubmission
            {
                SubmissionId = Guid.NewGuid(),
                VideoId = request.VideoId,
                SourceType = "video",
                UserId = request.UserId,
                AnswersJson = answersJson,
                ConfidenceJson = confidenceJson,
                Score = request.Score,
                Total = request.Total,
                SubmittedAt = DateTime.UtcNow,
            };
            await _unitOfWork.QuizSubmissions.AddAsync(existing, cancellationToken);
        }

        await MistakeCapture.CaptureAsync(
            _unitOfWork, request.UserId, "video", null, request.VideoId, request.Answers, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dto = existing.ToQuizSubmissionDto();

        return Result<QuizSubmissionDto>.Success(dto, "Quiz submission saved.");
    }
}
