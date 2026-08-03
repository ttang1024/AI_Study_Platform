using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Queries;

/// <summary>
/// Resolves a completed export to a short-lived signed URL.
///
/// <para>Signed and time-boxed rather than a permanent blob link: the archive is the most sensitive
/// object the platform produces, so possession of the URL should stop being possession of the data
/// almost immediately.</para>
/// </summary>
public record GetDataExportDownloadQuery(Guid UserId, Guid DataExportRequestId) : IRequest<Result<string>>;

public class GetDataExportDownloadQueryHandler : IRequestHandler<GetDataExportDownloadQuery, Result<string>>
{
    /// <summary>Long enough for a browser to start the download, short enough that a leaked URL ages out fast.</summary>
    private const int DownloadUrlLifetimeMinutes = 10;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorage;
    private readonly IAuditLogger _audit;

    public GetDataExportDownloadQueryHandler(
        IUnitOfWork unitOfWork, IBlobStorageService blobStorage, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _blobStorage = blobStorage;
        _audit = audit;
    }

    public async Task<Result<string>> Handle(
        GetDataExportDownloadQuery request, CancellationToken cancellationToken)
    {
        var export = await _unitOfWork.DataExportRequests.GetByIdAsync(request.DataExportRequestId, cancellationToken);

        // Ownership folded into the not-found answer: telling a stranger that an export id exists
        // but isn't theirs is more than they should learn from a guess.
        if (export == null || export.UserId != request.UserId)
            return Result<string>.Failure("Export not found.", "EXPORT_NOT_FOUND");

        if (!DataExportMapper.IsDownloadable(export))
            return Result<string>.Failure(
                export.Status == StudyPlatform.Domain.Entities.DataExportStatus.Failed
                    ? "That export failed. Request a new one."
                    : "That export isn't ready to download.",
                "EXPORT_NOT_READY");

        var url = await _blobStorage.GetSasUrlAsync(export.BlobUrl!, DownloadUrlLifetimeMinutes, cancellationToken);

        await _audit.LogAsync(AuditActions.DataExportDownloaded, request.UserId,
            targetType: "DataExportRequest", targetId: export.DataExportRequestId.ToString(),
            cancellationToken: cancellationToken);

        return Result<string>.Success(url);
    }
}
