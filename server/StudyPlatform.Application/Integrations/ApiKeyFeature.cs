using System.Security.Cryptography;
using System.Text;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Integrations;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record ApiKeyDto(
    Guid ApiKeyId,
    string Name,
    string Prefix,
    IReadOnlyList<string> Scopes,
    DateTime? LastUsedAt,
    DateTime? ExpiresAt,
    DateTime? RevokedAt,
    DateTime CreatedAt);

/// <summary>
/// The one response that carries the key itself. There is no read path that returns it again —
/// only a hash is stored.
/// </summary>
public record CreatedApiKeyDto(ApiKeyDto Key, string PlaintextKey);

public record CreateApiKeyRequest(string Name, IReadOnlyList<string> Scopes, int? ExpiresInDays);

// ── Key format and hashing ──────────────────────────────────────────────────

/// <summary>
/// Generation and hashing of API keys, kept together so the authentication handler and the creation
/// command cannot drift apart on format.
/// </summary>
public static class ApiKeyFormat
{
    /// <summary>
    /// Marks the string as a StudyPlatform key. Worth the bytes: secret scanners key off prefixes
    /// like this to spot a credential pasted into a public repository.
    /// </summary>
    public const string KeyPrefix = "sp_";

    /// <summary>How much of the key is stored in the clear so the owner can identify it in a list.</summary>
    private const int DisplayPrefixLength = 11;

    public static (string Plaintext, string Hash, string Prefix) Generate()
    {
        var random = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "").Replace("/", "").TrimEnd('=');

        var plaintext = KeyPrefix + random;
        return (plaintext, Hash(plaintext), plaintext[..Math.Min(DisplayPrefixLength, plaintext.Length)]);
    }

    /// <summary>
    /// SHA-256, hex-encoded. Fast by design — see <see cref="ApiKey.KeyHash"/> for why a password
    /// hash would be the wrong tool here.
    /// </summary>
    public static string Hash(string plaintext)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plaintext))).ToLowerInvariant();
}

// ── Create ──────────────────────────────────────────────────────────────────

public record CreateApiKeyCommand(Guid UserId, string Name, IReadOnlyList<string> Scopes, int? ExpiresInDays)
    : IRequest<Result<CreatedApiKeyDto>>;

public class CreateApiKeyCommandHandler : IRequestHandler<CreateApiKeyCommand, Result<CreatedApiKeyDto>>
{
    /// <summary>A ceiling per user, so a compromised session cannot mint an unbounded set of them.</summary>
    private const int MaxKeysPerUser = 20;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogger _audit;

    public CreateApiKeyCommandHandler(IUnitOfWork unitOfWork, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<Result<CreatedApiKeyDto>> Handle(
        CreateApiKeyCommand request, CancellationToken cancellationToken)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length == 0)
            return Result<CreatedApiKeyDto>.Failure("Give the key a name.", "NAME_REQUIRED");

        var scopes = (request.Scopes ?? Array.Empty<string>())
            .Select(s => s.Trim())
            .Where(ApiKeyScopes.IsValid)
            .Distinct()
            .ToList();

        // No scopes means no access, which is a key that silently does nothing — worse than an
        // error, because it fails at the caller's first request rather than here.
        if (scopes.Count == 0)
            return Result<CreatedApiKeyDto>.Failure(
                "Choose at least one scope.", "SCOPES_REQUIRED");

        var existing = await _unitOfWork.ApiKeys.GetForUserAsync(request.UserId, cancellationToken);
        if (existing.Count(k => k.RevokedAt == null) >= MaxKeysPerUser)
            return Result<CreatedApiKeyDto>.Failure(
                $"You can have {MaxKeysPerUser} active keys. Revoke one first.", "TOO_MANY_KEYS");

        var (plaintext, hash, prefix) = ApiKeyFormat.Generate();

        var key = new ApiKey
        {
            ApiKeyId = Guid.NewGuid(),
            UserId = request.UserId,
            Name = name,
            KeyHash = hash,
            Prefix = prefix,
            Scopes = string.Join(',', scopes),
            ExpiresAt = request.ExpiresInDays is > 0
                ? DateTime.UtcNow.AddDays(request.ExpiresInDays.Value)
                : null,
            CreatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.ApiKeys.AddAsync(key, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await _audit.LogAsync(AuditActions.ApiKeyCreated, request.UserId,
            targetType: "ApiKey", targetId: key.ApiKeyId.ToString(),
            metadata: new { name, scopes }, cancellationToken: cancellationToken);

        return Result<CreatedApiKeyDto>.Success(
            new CreatedApiKeyDto(ApiKeyMapper.ToDto(key), plaintext),
            "Key created. Copy it now — it won't be shown again.");
    }
}

// ── Read / revoke ───────────────────────────────────────────────────────────

public record GetApiKeysQuery(Guid UserId) : IRequest<Result<IReadOnlyList<ApiKeyDto>>>;

public class GetApiKeysQueryHandler : IRequestHandler<GetApiKeysQuery, Result<IReadOnlyList<ApiKeyDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetApiKeysQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<IReadOnlyList<ApiKeyDto>>> Handle(
        GetApiKeysQuery request, CancellationToken cancellationToken)
    {
        var keys = await _unitOfWork.ApiKeys.GetForUserAsync(request.UserId, cancellationToken);
        IReadOnlyList<ApiKeyDto> dtos = keys.Select(ApiKeyMapper.ToDto).ToList();
        return Result<IReadOnlyList<ApiKeyDto>>.Success(dtos);
    }
}

public record RevokeApiKeyCommand(Guid UserId, Guid ApiKeyId) : IRequest<Result>;

public class RevokeApiKeyCommandHandler : IRequestHandler<RevokeApiKeyCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogger _audit;

    public RevokeApiKeyCommandHandler(IUnitOfWork unitOfWork, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<Result> Handle(RevokeApiKeyCommand request, CancellationToken cancellationToken)
    {
        var key = await _unitOfWork.ApiKeys.GetByIdAsync(request.ApiKeyId, cancellationToken);
        if (key == null || key.UserId != request.UserId)
            return Result.Failure("Key not found.", "API_KEY_NOT_FOUND");

        if (key.RevokedAt != null)
            return Result.Failure("That key is already revoked.", "ALREADY_REVOKED");

        // Marked rather than deleted, so the audit trail keeps pointing at a row that explains what
        // the key was and when it stopped working.
        key.RevokedAt = DateTime.UtcNow;
        _unitOfWork.ApiKeys.Update(key);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await _audit.LogAsync(AuditActions.ApiKeyRevoked, request.UserId,
            targetType: "ApiKey", targetId: key.ApiKeyId.ToString(),
            cancellationToken: cancellationToken);

        return Result.Success("Key revoked.");
    }
}

internal static class ApiKeyMapper
{
    public static ApiKeyDto ToDto(ApiKey k) => new(
        k.ApiKeyId,
        k.Name,
        k.Prefix,
        k.Scopes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
        k.LastUsedAt,
        k.ExpiresAt,
        k.RevokedAt,
        k.CreatedAt);
}
