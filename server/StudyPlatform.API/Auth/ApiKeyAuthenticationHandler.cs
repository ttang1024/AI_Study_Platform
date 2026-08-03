using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Integrations;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.API.Auth;

public class ApiKeyAuthenticationOptions : AuthenticationSchemeOptions
{
    public const string SchemeName = "ApiKey";
}

/// <summary>
/// Authenticates a request carrying an API key, producing the same user-id claim a JWT would so
/// every controller's <c>User.GetUserId()</c> keeps working unchanged.
///
/// <para>Scopes are added as claims rather than checked here: this handler establishes <em>who</em>
/// is calling, and what they may do is an authorization question that belongs to the endpoint.</para>
/// </summary>
public class ApiKeyAuthenticationHandler : AuthenticationHandler<ApiKeyAuthenticationOptions>
{
    /// <summary>Header name for the key. Also accepted as <c>Authorization: Bearer sp_…</c>.</summary>
    public const string HeaderName = "X-Api-Key";

    /// <summary>Claim type carrying one granted scope. One claim per scope.</summary>
    public const string ScopeClaimType = "api_scope";

    /// <summary>
    /// How stale a "last used" timestamp may get before it is rewritten. Without a floor, every
    /// authenticated request would issue a write purely to update a label.
    /// </summary>
    private static readonly TimeSpan LastUsedPrecision = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopeFactory;

    public ApiKeyAuthenticationHandler(
        IOptionsMonitor<ApiKeyAuthenticationOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IServiceScopeFactory scopeFactory)
        : base(options, logger, encoder)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var presented = ReadKey(Request);

        // NoResult, not Fail: a request with no API key is not a failed API-key authentication, it
        // is a request for some other scheme to handle. Failing here would turn every ordinary JWT
        // request into an authentication error.
        if (string.IsNullOrEmpty(presented))
            return AuthenticateResult.NoResult();

        var hash = ApiKeyFormat.Hash(presented);

        using var scope = _scopeFactory.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        var key = await unitOfWork.ApiKeys.GetByHashAsync(hash, Context.RequestAborted);

        // One message for every rejection. Distinguishing "unknown key" from "revoked key" would
        // tell an attacker which of their guesses had once been real.
        if (key == null || !key.IsUsable(DateTime.UtcNow))
            return AuthenticateResult.Fail("Invalid API key.");

        var user = await unitOfWork.Users.GetByIdAsync(key.UserId, Context.RequestAborted);
        if (user == null || !user.IsActive)
            return AuthenticateResult.Fail("Invalid API key.");

        await unitOfWork.ApiKeys.TouchAsync(key.ApiKeyId, LastUsedPrecision, Context.RequestAborted);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Email, user.Email),
            // Lets an endpoint or a log tell an API-key call from a browser session.
            new("auth_method", "api_key"),
        };

        claims.AddRange(key.Scopes
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => new Claim(ScopeClaimType, s)));

        var identity = new ClaimsIdentity(claims, ApiKeyAuthenticationOptions.SchemeName);
        var principal = new ClaimsPrincipal(identity);

        return AuthenticateResult.Success(
            new AuthenticationTicket(principal, ApiKeyAuthenticationOptions.SchemeName));
    }

    /// <summary>
    /// Reads the key from either the dedicated header or an <c>Authorization: Bearer</c> value that
    /// looks like one of ours. Supporting both because tooling defaults differ, and the
    /// <c>sp_</c> prefix is what makes the bearer case unambiguous against a JWT.
    /// </summary>
    internal static string? ReadKey(HttpRequest request)
    {
        var header = request.Headers[HeaderName].ToString();
        if (!string.IsNullOrWhiteSpace(header))
            return header.Trim();

        var authorization = request.Headers.Authorization.ToString();
        if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var value = authorization["Bearer ".Length..].Trim();
            if (value.StartsWith(ApiKeyFormat.KeyPrefix, StringComparison.Ordinal))
                return value;
        }

        return null;
    }
}

/// <summary>
/// Requires that an API-key caller holds a given scope. Has no effect on JWT callers — a signed-in
/// user acting through the UI is not scope-limited, and applying key scopes to them would break
/// every existing endpoint this is placed on.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RequireApiScopeAttribute : Attribute, Microsoft.AspNetCore.Mvc.Filters.IAuthorizationFilter
{
    private readonly string _scope;

    public RequireApiScopeAttribute(string scope) => _scope = scope;

    public void OnAuthorization(Microsoft.AspNetCore.Mvc.Filters.AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        if (user.FindFirst("auth_method")?.Value != "api_key")
            return;

        if (!user.HasClaim(ApiKeyAuthenticationHandler.ScopeClaimType, _scope))
            context.Result = new Microsoft.AspNetCore.Mvc.ObjectResult(
                new StudyPlatform.Application.Common.BaseResponse
                {
                    Success = false,
                    Message = $"This API key is missing the '{_scope}' scope.",
                    ErrorCode = "INSUFFICIENT_SCOPE",
                })
            { StatusCode = StatusCodes.Status403Forbidden };
    }
}
