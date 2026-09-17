using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Analytics.Commands;

/// <summary>
/// Records one page view. Sent by the web app on every route change, signed in or not, so the
/// handler must treat every field as untrusted input and never fail the caller: a rejected beacon
/// is invisible to the visitor, and analytics is not worth an error in the console.
/// </summary>
/// <param name="UserId">The signed-in user, or null for anonymous traffic.</param>
/// <param name="UserAgent">Raw User-Agent header; classified and then discarded, never stored.</param>
/// <param name="SelfHost">This site's Host header, so a same-site referrer can be dropped.</param>
public record RecordPageVisitCommand(
    Guid? UserId,
    string Path,
    string? Referrer,
    string VisitorId,
    string SessionId,
    string? UserAgent,
    string? SelfHost) : IRequest<Result>;

public class RecordPageVisitCommandHandler : IRequestHandler<RecordPageVisitCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public RecordPageVisitCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result> Handle(RecordPageVisitCommand request, CancellationToken cancellationToken)
    {
        // Crawlers would otherwise dominate the landing page and every share link.
        if (PageVisitTelemetry.IsBot(request.UserAgent))
            return Result.Success("Ignored.");

        await _unitOfWork.PageVisits.AddAsync(new PageVisit
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            VisitorId = request.VisitorId,
            SessionId = request.SessionId,
            Path = PageVisitTelemetry.NormalizePath(request.Path),
            Referrer = PageVisitTelemetry.NormalizeReferrer(request.Referrer, request.SelfHost),
            Device = PageVisitTelemetry.ClassifyDevice(request.UserAgent),
            OccurredAt = DateTime.UtcNow,
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Recorded.");
    }
}
