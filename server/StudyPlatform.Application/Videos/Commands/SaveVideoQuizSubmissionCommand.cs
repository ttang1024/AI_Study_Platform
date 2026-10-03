using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
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
    private readonly IQuizSubmissionWriter _submissions;

    public SaveVideoQuizSubmissionCommandHandler(IUnitOfWork unitOfWork, IQuizSubmissionWriter submissions)
    {
        _unitOfWork = unitOfWork;
        _submissions = submissions;
    }

    public async Task<Result<QuizSubmissionDto>> Handle(SaveVideoQuizSubmissionCommand request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.Videos.GetByIdForUserAsync(request.VideoId, request.UserId, cancellationToken);
        if (video is null)
            return Result<QuizSubmissionDto>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        var dto = await _submissions.UpsertAsync(
            request.UserId, QuizSource.Video(request.VideoId),
            request.Answers, request.Score, request.Total, request.Confidence, cancellationToken);

        return Result<QuizSubmissionDto>.Success(dto, "Quiz submission saved.");
    }
}
