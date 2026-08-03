using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Commands;

/// <summary>
/// Queues a full export of the user's data. The archive is built by a background worker; this only
/// records the request.
/// </summary>
public record RequestDataExportCommand(Guid UserId) : IRequest<Result<DataExportDto>>;

public class RequestDataExportCommandHandler
    : IRequestHandler<RequestDataExportCommand, Result<DataExportDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogger _audit;

    public RequestDataExportCommandHandler(IUnitOfWork unitOfWork, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<Result<DataExportDto>> Handle(
        RequestDataExportCommand request, CancellationToken cancellationToken)
    {
        // One in flight at a time. The export walks every table the user appears in, so an unbounded
        // queue of them is a self-inflicted denial of service on the database.
        var active = await _unitOfWork.DataExportRequests.GetActiveForUserAsync(request.UserId, cancellationToken);
        if (active != null)
            return Result<DataExportDto>.Failure(
                "An export is already being prepared. You'll be able to download it shortly.",
                "EXPORT_ALREADY_PENDING");

        var entity = new DataExportRequest
        {
            DataExportRequestId = Guid.NewGuid(),
            UserId = request.UserId,
            Status = DataExportStatus.Pending,
            CreatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.DataExportRequests.AddAsync(entity, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await _audit.LogAsync(AuditActions.DataExportRequested, request.UserId,
            targetType: "DataExportRequest", targetId: entity.DataExportRequestId.ToString(),
            cancellationToken: cancellationToken);

        return Result<DataExportDto>.Success(
            DataExportMapper.ToDto(entity),
            "Preparing your export. This can take a few minutes for a large library.");
    }
}

/// <summary>Shared projection so the request, list, and download paths describe an export identically.</summary>
public static class DataExportMapper
{
    public static DataExportDto ToDto(DataExportRequest entity) => new(
        entity.DataExportRequestId,
        entity.Status,
        entity.CreatedAt,
        entity.CompletedAt,
        entity.SizeBytes,
        entity.ExpiresAt,
        entity.ErrorMessage,
        IsDownloadable(entity));

    /// <summary>
    /// An export is downloadable only while it is complete, has a blob, and has not expired.
    /// All three, because each fails independently: a failed build has no blob, and a completed
    /// build stops being offered once its window closes.
    /// </summary>
    public static bool IsDownloadable(DataExportRequest entity)
        => entity.Status == DataExportStatus.Completed
           && !string.IsNullOrEmpty(entity.BlobUrl)
           && (entity.ExpiresAt == null || entity.ExpiresAt > DateTime.UtcNow);
}
