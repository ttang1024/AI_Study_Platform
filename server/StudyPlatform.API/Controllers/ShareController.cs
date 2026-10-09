using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Share.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using System.Text.Json;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/share")]
[Produces("application/json")]
public class ShareController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorage;
    private readonly IRichTextSanitizer _sanitizer;

    public ShareController(IUnitOfWork unitOfWork, IBlobStorageService blobStorage, IRichTextSanitizer sanitizer)
    {
        _unitOfWork = unitOfWork;
        _blobStorage = blobStorage;
        _sanitizer = sanitizer;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateShare(
        [FromBody] CreateShareRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();

        // The anonymous media endpoints serve whatever the source path names, so a share may only name
        // a document or upload its creator owns.
        if (!await IsOwnedSourceAsync(request.SourceUrl, userId, cancellationToken))
            return BadRequest(BaseResponse<CreateShareResponse>.Fail(
                "You can only share content you own.", "SOURCE_NOT_OWNED"));

        var token = GenerateToken();

        var share = new ShareToken
        {
            Id = Guid.NewGuid(),
            Token = token,
            OwnerId = userId,
            Title = request.Title,
            Summary = request.Summary,
            MindMapText = request.MindMapText,
            NotesHtml = SanitizeNotes(request.NotesHtml, request.SourceType),
            QuizzesJson = request.QuizzesJson,
            FlashcardsJson = request.FlashcardsJson,
            GlossaryJson = request.GlossaryJson,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = request.ExpiresInDays.HasValue
                ? DateTime.UtcNow.AddDays(request.ExpiresInDays.Value)
                : null,
            SourceType = request.SourceType,
            SourceUrl = request.SourceUrl,
            OriginalArticleUrl = request.OriginalArticleUrl,
        };

        await _unitOfWork.ShareTokens.AddAsync(share, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Ok(BaseResponse<CreateShareResponse>.Ok(new CreateShareResponse(token, $"/share/{token}")));
    }

    [HttpGet("{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetShare(string token, CancellationToken cancellationToken = default)
    {
        var share = await _unitOfWork.ShareTokens.GetByTokenAsync(token, cancellationToken);
        if (share == null)
            return NotFound(BaseResponse<object>.Fail("Share not found"));

        if (share.ExpiresAt.HasValue && share.ExpiresAt.Value < DateTime.UtcNow)
            return StatusCode(410, BaseResponse<object>.Fail("This share link has expired"));

        object? quizzes = null;
        object? flashcards = null;
        object? glossary = null;

        if (share.QuizzesJson != null)
        {
            try { quizzes = JsonSerializer.Deserialize<object>(share.QuizzesJson); } catch { }
        }
        if (share.FlashcardsJson != null)
        {
            try { flashcards = JsonSerializer.Deserialize<object>(share.FlashcardsJson); } catch { }
        }
        if (share.GlossaryJson != null)
        {
            try { glossary = JsonSerializer.Deserialize<object>(share.GlossaryJson); } catch { }
        }

        string? fileType = null;
        if (share.SourceType == "document" && share.SourceUrl != null && TryParseDocPath(share.SourceUrl, out var fileDocId))
        {
            var fileDoc = await _unitOfWork.Documents.GetSourceRefAsync(fileDocId, share.OwnerId, cancellationToken);
            if (fileDoc != null)
                fileType = fileDoc.ContentType;
        }

        var dto = new ShareDto(
            share.Token,
            share.Title,
            share.Owner?.FullName ?? "Anonymous",
            share.Summary,
            share.MindMapText,
            // Sanitized again on the way out: shares written before sanitization existed are still stored raw.
            SanitizeNotes(share.NotesHtml, share.SourceType),
            quizzes,
            flashcards,
            glossary,
            share.CreatedAt.ToString("O"),
            share.ExpiresAt?.ToString("O"),
            share.SourceType,
            share.SourceUrl,
            share.OriginalArticleUrl,
            fileType
        );

        return Ok(BaseResponse<ShareDto>.Ok(dto));
    }

    // GET /api/share/{token}/audio  — anonymous, redirects to a fresh SAS URL
    [HttpGet("{token}/audio")]
    [AllowAnonymous]
    public async Task<IActionResult> StreamAudio(string token, CancellationToken cancellationToken = default)
    {
        var (doc, error) = await ResolveSharedDocumentAsync(token, t => t is "audio" or "podcast", cancellationToken);
        if (error != null) return error;

        // Podcast episodes store a direct MP3 URL — no SAS generation needed
        if (doc!.ContentType == "audio/podcast")
            return Redirect(doc.BlobUrl);

        var sasUrl = await _blobStorage.GetSasUrlAsync(doc.BlobUrl, expiryMinutes: 60, cancellationToken);
        return Redirect(sasUrl);
    }

    // GET /api/share/{token}/article  — anonymous, streams stored article HTML
    [HttpGet("{token}/article")]
    [AllowAnonymous]
    public async Task<IActionResult> GetArticle(string token, CancellationToken cancellationToken = default)
    {
        var (doc, error) = await ResolveSharedDocumentAsync(token, t => t == "article", cancellationToken);
        if (error != null) return error;

        var stream = await _blobStorage.DownloadAsync(doc!.BlobUrl, cancellationToken);
        return this.UntrustedFile(stream, "text/plain; charset=utf-8");
    }

    // GET /api/share/{token}/file  — anonymous, streams document file through the server (avoids CORS)
    [HttpGet("{token}/file")]
    [AllowAnonymous]
    public async Task<IActionResult> StreamFile(string token, CancellationToken cancellationToken = default)
    {
        var (doc, error) = await ResolveSharedDocumentAsync(token, t => t == "document", cancellationToken);
        if (error != null) return error;

        var stream = await _blobStorage.DownloadAsync(doc!.BlobUrl, cancellationToken);
        return this.UntrustedFile(stream, doc.ContentType);
    }

    // GET /api/share/{token}/video — anonymous, streams an uploaded video shared by its owner
    [HttpGet("{token}/video")]
    [AllowAnonymous]
    public async Task<IActionResult> StreamVideo(string token, CancellationToken cancellationToken = default)
    {
        var (share, error) = await ResolveActiveShareAsync(token, t => t == "upload", cancellationToken);
        if (error != null) return error;

        if (!TryParseVideoPath(share!.SourceUrl!, out var videoId))
            return NotFound();

        var video = await _unitOfWork.Videos.GetByIdAsync(videoId, cancellationToken);
        if (video == null || video.UserId != share.OwnerId || video.SourceType != "upload")
            return NotFound();

        // Redirect rather than proxy, as for the owner's own playback (VideoController.GetUploadedVideoFile).
        return Redirect(await _blobStorage.GetMediaUrlAsync(
            video.VideoUrl, MediaFormatting.GetVideoContentType(video.VideoUrl), cancellationToken: cancellationToken));
    }

    /// <summary>
    /// Looks up a share for one of the anonymous media endpoints: 404 unless it exists, has a source
    /// path and is of an accepted source type; 410 once expired.
    /// </summary>
    private async Task<(ShareToken? Share, IActionResult? Error)> ResolveActiveShareAsync(
        string token, Func<string?, bool> isAcceptedSourceType, CancellationToken cancellationToken)
    {
        var share = await _unitOfWork.ShareTokens.GetByTokenAsync(token, cancellationToken);
        if (share == null || !isAcceptedSourceType(share.SourceType) || share.SourceUrl == null)
            return (null, NotFound());
        if (share.ExpiresAt.HasValue && share.ExpiresAt.Value < DateTime.UtcNow)
            return (null, StatusCode(410, "Share link has expired"));
        return (share, null);
    }

    private async Task<(DocumentSourceRef? Doc, IActionResult? Error)> ResolveSharedDocumentAsync(
        string token, Func<string?, bool> isAcceptedSourceType, CancellationToken cancellationToken)
    {
        var (share, error) = await ResolveActiveShareAsync(token, isAcceptedSourceType, cancellationToken);
        if (error != null) return (null, error);

        if (!TryParseDocPath(share!.SourceUrl!, out var docId))
            return (null, NotFound());

        var doc = await _unitOfWork.Documents.GetSourceRefAsync(docId, share.OwnerId, cancellationToken);
        return doc == null ? (null, NotFound()) : (doc, null);
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
        if (TryParseVideoPath(sourceUrl, out var videoId))
        {
            var video = await _unitOfWork.Videos.GetByIdAsync(videoId, cancellationToken);
            return video != null && video.UserId == userId;
        }

        if (TryParseDocPath(sourceUrl, out var docId))
            return await _unitOfWork.Documents.GetSourceRefAsync(docId, userId, cancellationToken) != null;

        return true;
    }

    /// <summary>
    /// Notes are rendered as HTML by every client, so they are sanitized — except a chat share's JSON
    /// transcript, which clients render as plain text / Markdown and which HTML-encoding would corrupt.
    /// The exemption matches exactly the shape clients route to their transcript renderer (source type
    /// "chat" and a <c>chat-transcript</c> payload); anything else is treated as HTML.
    /// </summary>
    private string? SanitizeNotes(string? notes, string? sourceType)
    {
        if (string.IsNullOrWhiteSpace(notes) || (sourceType == "chat" && IsChatTranscriptJson(notes)))
            return notes;
        return _sanitizer.Sanitize(notes);
    }

    private static bool IsChatTranscriptJson(string value)
    {
        if (!value.TrimStart().StartsWith('{'))
            return false;
        try
        {
            using var doc = JsonDocument.Parse(value);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("type", out var type)
                && type.ValueKind == JsonValueKind.String
                && type.GetString() == "chat-transcript";
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool TryParseDocPath(string sourceUrl, out Guid docId)
    {
        docId = Guid.Empty;
        var parts = sourceUrl.Split('/');
        return parts.Length == 2 && Guid.TryParse(parts[1], out docId);
    }

    private static bool TryParseVideoPath(string sourceUrl, out Guid videoId)
    {
        videoId = Guid.Empty;
        var parts = sourceUrl.Split('/');
        return parts.Length == 2 && parts[0] == "video" && Guid.TryParse(parts[1], out videoId);
    }

    private static string GenerateToken()
    {
        var bytes = new byte[9];
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }
}
