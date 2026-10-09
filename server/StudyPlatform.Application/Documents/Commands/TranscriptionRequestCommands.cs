using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

/// <summary>Records that a transcription has been queued, so it survives an API restart.</summary>
public record RequestTranscriptionCommand(Guid DocumentId, Guid UserId) : IRequest<Result>;

public class RequestTranscriptionCommandHandler : IRequestHandler<RequestTranscriptionCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public RequestTranscriptionCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result> Handle(RequestTranscriptionCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetOwnedAsync(request.DocumentId, request.UserId, cancellationToken);
        if (document == null)
            return Result.Failure("Audio file not found.", "DOCUMENT_NOT_FOUND");

        document.TranscriptionRequestedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

/// <summary>
/// Clears the queued marker after a transcription failed, so the worker's startup recovery does not
/// retry a broken file on every restart. The user can request it again.
/// </summary>
public record AbandonTranscriptionCommand(Guid DocumentId) : IRequest<Result>;

public class AbandonTranscriptionCommandHandler : IRequestHandler<AbandonTranscriptionCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public AbandonTranscriptionCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result> Handle(AbandonTranscriptionCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null)
            return Result.Success();

        document.TranscriptionRequestedAt = null;
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
