using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Billing;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.API.Controllers;

public record PlanDto(
    string Key,
    string DisplayName,
    decimal MonthlyPriceUsd,
    long DailyTokenLimit,
    bool IncludesHostedKeys,
    int MaxClassrooms,
    int MaxStudentsPerClassroom);

public record MyPlanDto(
    PlanDto Plan,
    string Source,
    DateTime? ExpiresAt,
    string Status,
    bool BillingEnabled,
    bool CanManageBilling,
    long TokensUsedToday,
    long DailyTokenLimit);

public record CheckoutRequest(string PlanKey, string SuccessUrl, string CancelUrl);

/// <summary>
/// Plans, the current user's entitlement, and checkout. Every deployment exposes this; when no
/// payment processor is configured the endpoints still answer, reporting billing as disabled so the
/// client can hide upgrade affordances rather than 404 on them.
/// </summary>
[ApiController]
[Route("api/billing")]
[Produces("application/json")]
public class BillingController : ControllerBase
{
    private readonly IEntitlementService _entitlements;
    private readonly IBillingProvider _billing;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiUsageRecorder _usage;
    private readonly ILogger<BillingController> _logger;

    public BillingController(
        IEntitlementService entitlements,
        IBillingProvider billing,
        IUnitOfWork unitOfWork,
        IAiUsageRecorder usage,
        ILogger<BillingController> logger)
    {
        _entitlements = entitlements;
        _billing = billing;
        _unitOfWork = unitOfWork;
        _usage = usage;
        _logger = logger;
    }

    private static PlanDto ToDto(Plan p) => new(
        p.Key, p.DisplayName, p.MonthlyPriceUsd, p.DailyTokenLimit,
        p.IncludesHostedKeys, p.MaxClassrooms, p.MaxStudentsPerClassroom);

    /// <summary>The plan catalog. Public: the pricing page renders from it before sign-in.</summary>
    [HttpGet("plans")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<PlanDto>>), 200)]
    public IActionResult GetPlans()
        => Ok(BaseResponse<IEnumerable<PlanDto>>.Ok(PlanCatalog.All.Select(ToDto)));

    /// <summary>The caller's effective plan, where it came from, and today's token usage.</summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(BaseResponse<MyPlanDto>), 200)]
    public async Task<IActionResult> GetMyPlan(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var entitlement = await _entitlements.GetForUserAsync(userId, cancellationToken);

        var subscription = await _unitOfWork.Subscriptions.GetByUserAsync(userId, cancellationToken);
        var used = await _usage.GetTokensUsedTodayAsync(userId, cancellationToken);
        var limit = await _usage.GetDailyTokenLimitAsync(userId, cancellationToken);

        var dto = new MyPlanDto(
            ToDto(entitlement.Plan),
            entitlement.Source,
            entitlement.ExpiresAt,
            subscription?.Status ?? SubscriptionStatuses.Active,
            BillingEnabled: _billing.IsEnabled,
            // Only the holder of a personal subscription can open the portal; a plan inherited from
            // an organization is managed by that organization's admins, not by this user.
            CanManageBilling: _billing.IsEnabled && subscription?.ExternalCustomerId != null,
            TokensUsedToday: used,
            DailyTokenLimit: limit);

        return Ok(BaseResponse<MyPlanDto>.Ok(dto));
    }

    /// <summary>Starts checkout for a paid plan and returns the URL to redirect to.</summary>
    [HttpPost("checkout")]
    [Authorize]
    [ProducesResponseType(typeof(BaseResponse<CheckoutSession>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateCheckout(
        [FromBody] CheckoutRequest request, CancellationToken cancellationToken)
    {
        if (!_billing.IsEnabled)
            return BadRequest(BaseResponse<CheckoutSession>.Fail("Billing is not enabled.", "BILLING_DISABLED"));

        if (request.PlanKey == PlanCatalog.FreeKey)
            return BadRequest(BaseResponse<CheckoutSession>.Fail("The free plan needs no checkout.", "INVALID_PLAN"));

        var userId = User.GetUserId();
        var user = await _unitOfWork.Users.GetByIdAsync(userId, cancellationToken);
        if (user == null)
            return BadRequest(BaseResponse<CheckoutSession>.Fail("User not found.", "NOT_FOUND"));

        var session = await _billing.CreateCheckoutSessionAsync(
            userId, user.Email, request.PlanKey, request.SuccessUrl, request.CancelUrl, cancellationToken);

        return session == null
            ? BadRequest(BaseResponse<CheckoutSession>.Fail("Could not start checkout.", "CHECKOUT_FAILED"))
            : Ok(BaseResponse<CheckoutSession>.Ok(session));
    }

    /// <summary>URL of the processor's self-service portal for managing or cancelling.</summary>
    [HttpPost("portal")]
    [Authorize]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreatePortal(
        [FromQuery] string returnUrl, CancellationToken cancellationToken)
    {
        var subscription = await _unitOfWork.Subscriptions.GetByUserAsync(User.GetUserId(), cancellationToken);
        if (subscription?.ExternalCustomerId == null)
            return BadRequest(BaseResponse<string>.Fail("No billing account to manage.", "NO_CUSTOMER"));

        var url = await _billing.CreatePortalUrlAsync(subscription.ExternalCustomerId, returnUrl, cancellationToken);

        return url == null
            ? BadRequest(BaseResponse<string>.Fail("Could not open the billing portal.", "PORTAL_FAILED"))
            : Ok(BaseResponse<string>.Ok(url));
    }

    /// <summary>
    /// Processor callback. Anonymous by necessity — the processor holds no JWT — so authenticity
    /// rests entirely on the signature check inside ParseWebhook, which returns null unless the
    /// payload verifies against the configured endpoint secret.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    [ProducesResponseType(200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Webhook(CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync(cancellationToken);

        var signature = Request.Headers["Stripe-Signature"].FirstOrDefault();
        var evt = _billing.ParseWebhook(payload, signature);

        if (evt == null)
            return BadRequest();

        if (string.IsNullOrEmpty(evt.ExternalCustomerId))
            return Ok(); // Nothing to attribute it to; acknowledge so it is not retried forever.

        var subscription = await _unitOfWork.Subscriptions.GetByExternalIdAsync(
            evt.ExternalCustomerId, evt.ExternalSubscriptionId, cancellationToken);

        if (subscription == null)
        {
            // First event for this customer — checkout.session.completed carries the user id we
            // stamped into metadata at checkout, which is the only link back to our account.
            if (!Guid.TryParse(GetMetadataUserId(payload), out var newUserId))
                return Ok();

            subscription = new Subscription
            {
                SubscriptionId = Guid.NewGuid(),
                UserId = newUserId,
                CreatedAt = DateTime.UtcNow,
            };
            await _unitOfWork.Subscriptions.AddAsync(subscription, cancellationToken);
        }

        subscription.ExternalCustomerId = evt.ExternalCustomerId;
        subscription.ExternalSubscriptionId = evt.ExternalSubscriptionId ?? subscription.ExternalSubscriptionId;
        subscription.PlanKey = evt.PlanKey ?? subscription.PlanKey;
        subscription.Status = evt.Status ?? subscription.Status;
        subscription.CurrentPeriodEnd = evt.CurrentPeriodEnd ?? subscription.CurrentPeriodEnd;
        subscription.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Subscriptions.Update(subscription);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // The plan just changed; drop the cached entitlement so the next call sees it immediately.
        if (subscription.UserId is { } uid)
            await _entitlements.InvalidateAsync(uid, cancellationToken);

        _logger.LogInformation(
            "Applied billing event {EventType} to subscription {SubscriptionId}.",
            evt.Type, subscription.SubscriptionId);

        return Ok();
    }

    private static string? GetMetadataUserId(string payload)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(payload);
            var obj = doc.RootElement.GetProperty("data").GetProperty("object");

            if (obj.TryGetProperty("client_reference_id", out var reference)
                && reference.ValueKind == System.Text.Json.JsonValueKind.String)
                return reference.GetString();

            return obj.TryGetProperty("metadata", out var metadata)
                   && metadata.TryGetProperty("userId", out var uid)
                ? uid.GetString()
                : null;
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }
}
