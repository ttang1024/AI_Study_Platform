using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Queries;

/// <summary>The user's own security history — their account activity, not the platform's.</summary>
public record GetAuditLogQuery(Guid UserId, int Page = 1, int PageSize = 25)
    : IRequest<Result<PaginatedList<AuditEntryDto>>>;

public class GetAuditLogQueryHandler
    : IRequestHandler<GetAuditLogQuery, Result<PaginatedList<AuditEntryDto>>>
{
    private const int MaxPageSize = 100;

    private readonly IAuditLogRepository _auditLog;

    public GetAuditLogQueryHandler(IAuditLogRepository auditLog)
    {
        _auditLog = auditLog;
    }

    public async Task<Result<PaginatedList<AuditEntryDto>>> Handle(
        GetAuditLogQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        var (items, total) = await _auditLog.GetForUserAsync(request.UserId, page, pageSize, cancellationToken);

        var dtos = items.Select(e => new AuditEntryDto(
            e.AuditLogEntryId,
            e.Action,
            e.ActorUserId,
            e.SubjectUserId,
            e.TargetType,
            e.TargetId,
            e.MetadataJson,
            e.IpAddress,
            e.UserAgent,
            e.CreatedAt)).ToList();

        return Result<PaginatedList<AuditEntryDto>>.Success(
            new PaginatedList<AuditEntryDto>(dtos, total, page, pageSize));
    }
}
