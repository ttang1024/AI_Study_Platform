using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Share;
using StudyPlatform.Application.Share.Commands;
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
    private readonly IMediator _mediator;
    private readonly IDocumentRepository _documents;
    private readonly IVideoRepository _videos;
    private readonly IShareTokenRepository _shareTokens;
    private readonly IBlobStorageService _blobStorage;
    private readonly IRichTextSanitizer _sanitizer;

    public ShareController(IMediator mediator, IDocumentRepository documents, IVideoRepository videos, IShareTokenRepository shareTokens, IBlobStorageService blobStorage, IRichTextSanitizer sanitizer)
    {
        _mediator = mediator;
        _documents = documents;
        _videos = videos;
        _shareTokens = shareTokens;
        _blobStorage = blobStorage;
        _sanitizer = sanitizer;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateShare(
        [FromBody] CreateShareRequest request,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new CreateShareCommand(User.GetUserId(), request), cancellationToken);
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<CreateShareResponse>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<CreateShareResponse>.Ok(result.Data!));
    }

    [HttpGet("{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetShare(string token, CancellationToken cancellationToken = default)
    {
        var share = await _shareTokens.GetByTokenAsync(token, cancellationToken);
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
        if (share.SourceType == "document" && share.SourceUrl != null && ShareSources.TryParseDocPath(share.SourceUrl, out var fileDocId))
        {
            var fileDoc = await _documents.GetSourceRefAsync(fileDocId, share.OwnerId, cancellationToken);
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

        // Podcast episodes store a direct MP3 URL — no SAS generation needed. That URL came from a page
        // the sharer chose, so this route would otherwise bounce anyone who opened it from toto-study.com
        // to wherever that is. Only a media element may follow it: browsers mark a top-level navigation
        // Sec-Fetch-Dest: document, and an <audio> source load "audio". Native players send no header.
        if (doc!.ContentType == "audio/podcast")
        {
            var destination = Request.Headers["Sec-Fetch-Dest"].ToString();
            if (destination is not ("" or "audio" or "video" or "empty")
                || !Uri.TryCreate(doc.BlobUrl, UriKind.Absolute, out var audioUrl)
                || audioUrl.Scheme is not ("https" or "http"))
                return NotFound();
            return Redirect(audioUrl.AbsoluteUri);
        }

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

        if (!ShareSources.TryParseVideoPath(share!.SourceUrl!, out var videoId))
            return NotFound();

        var video = await _videos.GetByIdAsync(videoId, cancellationToken);
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
        var share = await _shareTokens.GetByTokenAsync(token, cancellationToken);
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

        if (!ShareSources.TryParseDocPath(share!.SourceUrl!, out var docId))
            return (null, NotFound());

        var doc = await _documents.GetSourceRefAsync(docId, share.OwnerId, cancellationToken);
        return doc == null ? (null, NotFound()) : (doc, null);
    }

    private string? SanitizeNotes(string? notes, string? sourceType)
        => ShareSources.SanitizeNotes(_sanitizer, notes, sourceType);
}
