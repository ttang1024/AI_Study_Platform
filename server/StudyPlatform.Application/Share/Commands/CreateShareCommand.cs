using FluentValidation;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Share.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Share.Commands;

/// <summary>Publishes a snapshot of the caller's content under an unguessable public token.</summary>
public record CreateShareCommand(Guid UserId, CreateShareRequest Request) : IRequest<Result<CreateShareResponse>>;

/// <summary>
/// Bounds on what an anonymous page will serve. Without them a huge <c>ExpiresInDays</c> overflowed the
/// expiry date into a 500, a negative one created a share that was born expired, and any field could
/// carry up to Kestrel's 30 MB request limit into a row.
/// </summary>
public class CreateShareCommandValidator : AbstractValidator<CreateShareCommand>
{
    public const int MaxExpiryDays = 365;
    public const int MaxTextLength = 1_000_000;
    public const int MaxJsonLength = 5_000_000;

    public CreateShareCommandValidator()
    {
        RuleFor(c => c.Request).NotNull();
        RuleFor(c => c.Request.Title).NotEmpty().MaximumLength(300);
        RuleFor(c => c.Request.ExpiresInDays).InclusiveBetween(1, MaxExpiryDays).When(c => c.Request.ExpiresInDays.HasValue);
        RuleFor(c => c.Request.Summary).MaximumLength(MaxTextLength);
        RuleFor(c => c.Request.MindMapText).MaximumLength(MaxTextLength);
        RuleFor(c => c.Request.NotesHtml).MaximumLength(MaxTextLength);
        RuleFor(c => c.Request.QuizzesJson).MaximumLength(MaxJsonLength);
        RuleFor(c => c.Request.FlashcardsJson).MaximumLength(MaxJsonLength);
        RuleFor(c => c.Request.GlossaryJson).MaximumLength(MaxJsonLength);
        RuleFor(c => c.Request.SourceType).MaximumLength(32);
        RuleFor(c => c.Request.SourceUrl).MaximumLength(2048);
        RuleFor(c => c.Request.OriginalArticleUrl).MaximumLength(2048);
    }
}

public class CreateShareCommandHandler : IRequestHandler<CreateShareCommand, Result<CreateShareResponse>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDocumentRepository _documents;
    private readonly IVideoRepository _videos;
    private readonly IShareTokenRepository _shareTokens;
    private readonly IRichTextSanitizer _sanitizer;

    public CreateShareCommandHandler(IUnitOfWork unitOfWork, IDocumentRepository documents, IVideoRepository videos, IShareTokenRepository shareTokens, IRichTextSanitizer sanitizer)
    {
        _unitOfWork = unitOfWork;
        _documents = documents;
        _videos = videos;
        _shareTokens = shareTokens;
        _sanitizer = sanitizer;
    }

    public async Task<Result<CreateShareResponse>> Handle(CreateShareCommand command, CancellationToken cancellationToken)
    {
        var request = command.Request;

        // The anonymous media endpoints serve whatever the source path names, so a share may only name
        // a document or upload its creator owns.
        if (!await IsOwnedSourceAsync(request.SourceUrl, command.UserId, cancellationToken))
            return Result<CreateShareResponse>.Failure("You can only share content you own.", "SOURCE_NOT_OWNED");

        var token = GenerateToken();
        await _shareTokens.AddAsync(new ShareToken
        {
            Id = Guid.NewGuid(),
            Token = token,
            OwnerId = command.UserId,
            Title = request.Title,
            Summary = request.Summary,
            MindMapText = request.MindMapText,
            NotesHtml = ShareSources.SanitizeNotes(_sanitizer, request.NotesHtml, request.SourceType),
            QuizzesJson = request.QuizzesJson,
            FlashcardsJson = request.FlashcardsJson,
            GlossaryJson = request.GlossaryJson,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = request.ExpiresInDays.HasValue ? DateTime.UtcNow.AddDays(request.ExpiresInDays.Value) : null,
            SourceType = request.SourceType,
            SourceUrl = request.SourceUrl,
            OriginalArticleUrl = request.OriginalArticleUrl,
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<CreateShareResponse>.Success(new CreateShareResponse(token, $"/share/{token}"));
    }

    /// <summary>
    /// True when <paramref name="sourceUrl"/> is not an internal reference (empty, or an external URL
    /// such as a YouTube link), or names a document or uploaded video owned by <paramref name="userId"/>.
    /// </summary>
    private async Task<bool> IsOwnedSourceAsync(string? sourceUrl, Guid userId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(sourceUrl))
            return true;

        // Video first: "video/{id}" also has the two-segment shape of a document path.
        if (ShareSources.TryParseVideoPath(sourceUrl, out var videoId))
        {
            var video = await _videos.GetByIdAsync(videoId, cancellationToken);
            return video != null && video.UserId == userId;
        }

        if (ShareSources.TryParseDocPath(sourceUrl, out var docId))
            return await _documents.GetSourceRefAsync(docId, userId, cancellationToken) != null;

        return true;
    }

    /// <summary>72 random bits, URL-safe.</summary>
    private static string GenerateToken()
    {
        var bytes = new byte[9];
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }
}
