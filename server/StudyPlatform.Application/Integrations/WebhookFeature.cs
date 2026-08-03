using System.Security.Cryptography;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Integrations;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record WebhookDto(
    Guid WebhookId,
    string Url,
    IReadOnlyList<string> Events,
    bool IsActive,
    DateTime? LastDeliveryAt,
    int? LastStatusCode,
    int ConsecutiveFailures,
    DateTime CreatedAt);

/// <summary>Returned once, on creation: the signing secret the receiver needs to verify deliveries.</summary>
public record CreatedWebhookDto(WebhookDto Webhook, string Secret);

public record CreateWebhookRequest(string Url, IReadOnlyList<string> Events);

// ── Create ──────────────────────────────────────────────────────────────────

public record CreateWebhookCommand(Guid UserId, string Url, IReadOnlyList<string> Events)
    : IRequest<Result<CreatedWebhookDto>>;

public class CreateWebhookCommandHandler : IRequestHandler<CreateWebhookCommand, Result<CreatedWebhookDto>>
{
    private const int MaxWebhooksPerUser = 10;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogger _audit;

    public CreateWebhookCommandHandler(IUnitOfWork unitOfWork, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<Result<CreatedWebhookDto>> Handle(
        CreateWebhookCommand request, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(request.Url, UriKind.Absolute, out var uri))
            return Result<CreatedWebhookDto>.Failure("That isn't a valid URL.", "INVALID_URL");

        // HTTPS only. The payload carries the user's study activity and the signature header, and
        // there is no reason to ship either in the clear to a third-party endpoint.
        if (uri.Scheme != Uri.UriSchemeHttps)
            return Result<CreatedWebhookDto>.Failure("Webhook URLs must use HTTPS.", "HTTPS_REQUIRED");

        var events = (request.Events ?? Array.Empty<string>())
            .Select(e => e.Trim())
            .Where(WebhookEvents.IsValid)
            .Distinct()
            .ToList();

        if (events.Count == 0)
            return Result<CreatedWebhookDto>.Failure("Choose at least one event.", "EVENTS_REQUIRED");

        var existing = await _unitOfWork.Webhooks.GetForUserAsync(request.UserId, cancellationToken);
        if (existing.Count >= MaxWebhooksPerUser)
            return Result<CreatedWebhookDto>.Failure(
                $"You can have {MaxWebhooksPerUser} webhooks. Delete one first.", "TOO_MANY_WEBHOOKS");

        var secret = "whsec_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

        var webhook = new Webhook
        {
            WebhookId = Guid.NewGuid(),
            UserId = request.UserId,
            Url = uri.ToString(),
            Secret = secret,
            Events = string.Join(',', events),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.Webhooks.AddAsync(webhook, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await _audit.LogAsync(AuditActions.WebhookCreated, request.UserId,
            targetType: "Webhook", targetId: webhook.WebhookId.ToString(),
            metadata: new { host = uri.Host, events }, cancellationToken: cancellationToken);

        return Result<CreatedWebhookDto>.Success(
            new CreatedWebhookDto(WebhookMapper.ToDto(webhook), secret),
            "Webhook created. Save the signing secret — it won't be shown again.");
    }
}

// ── Read / delete ───────────────────────────────────────────────────────────

public record GetWebhooksQuery(Guid UserId) : IRequest<Result<IReadOnlyList<WebhookDto>>>;

public class GetWebhooksQueryHandler : IRequestHandler<GetWebhooksQuery, Result<IReadOnlyList<WebhookDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetWebhooksQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<IReadOnlyList<WebhookDto>>> Handle(
        GetWebhooksQuery request, CancellationToken cancellationToken)
    {
        var webhooks = await _unitOfWork.Webhooks.GetForUserAsync(request.UserId, cancellationToken);
        IReadOnlyList<WebhookDto> dtos = webhooks.Select(WebhookMapper.ToDto).ToList();
        return Result<IReadOnlyList<WebhookDto>>.Success(dtos);
    }
}

public record DeleteWebhookCommand(Guid UserId, Guid WebhookId) : IRequest<Result>;

public class DeleteWebhookCommandHandler : IRequestHandler<DeleteWebhookCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogger _audit;

    public DeleteWebhookCommandHandler(IUnitOfWork unitOfWork, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<Result> Handle(DeleteWebhookCommand request, CancellationToken cancellationToken)
    {
        var webhook = await _unitOfWork.Webhooks.GetByIdAsync(request.WebhookId, cancellationToken);
        if (webhook == null || webhook.UserId != request.UserId)
            return Result.Failure("Webhook not found.", "WEBHOOK_NOT_FOUND");

        _unitOfWork.Webhooks.Remove(webhook);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await _audit.LogAsync(AuditActions.WebhookDeleted, request.UserId,
            targetType: "Webhook", targetId: request.WebhookId.ToString(),
            cancellationToken: cancellationToken);

        return Result.Success("Webhook deleted.");
    }
}

internal static class WebhookMapper
{
    /// <summary>Never includes the secret — that leaves the server exactly once, at creation.</summary>
    public static WebhookDto ToDto(Webhook w) => new(
        w.WebhookId,
        w.Url,
        w.Events.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
        w.IsActive,
        w.LastDeliveryAt,
        w.LastStatusCode,
        w.ConsecutiveFailures,
        w.CreatedAt);
}
