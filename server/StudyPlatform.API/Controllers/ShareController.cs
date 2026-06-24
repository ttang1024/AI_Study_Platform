using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Share.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using System.Text.Json;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/share")]
[Produces("application/json")]
public class ShareController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorage;

    public ShareController(IUnitOfWork unitOfWork, IBlobStorageService blobStorage)
    {
        _unitOfWork = unitOfWork;
        _blobStorage = blobStorage;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateShare(
        [FromBody] CreateShareRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();
        var token = GenerateToken();

        var share = new ShareToken
        {
            Id = Guid.NewGuid(),
            Token = token,
            OwnerId = userId,
            Title = request.Title,
            Summary = request.Summary,
            MindMapText = request.MindMapText,
            NotesHtml = request.NotesHtml,
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
            var fileDoc = await _unitOfWork.Documents.GetByIdWithDetailsAsync(fileDocId, cancellationToken);
            if (fileDoc != null)
                fileType = fileDoc.ContentType;
        }

        var dto = new ShareDto(
            share.Token,
            share.Title,
            share.Owner?.FullName ?? "Anonymous",
            share.Summary,
            share.MindMapText,
            share.NotesHtml,
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
        var share = await _unitOfWork.ShareTokens.GetByTokenAsync(token, cancellationToken);
        if (share == null || (share.SourceType != "audio" && share.SourceType != "podcast") || share.SourceUrl == null)
            return NotFound();
        if (share.ExpiresAt.HasValue && share.ExpiresAt.Value < DateTime.UtcNow)
            return StatusCode(410, "Share link has expired");

        if (!TryParseDocPath(share.SourceUrl, out var docId))
            return NotFound();

        var doc = await _unitOfWork.Documents.GetByIdWithDetailsAsync(docId, cancellationToken);
        if (doc == null) return NotFound();

        // Podcast episodes store a direct MP3 URL — no SAS generation needed
        if (doc.ContentType == "audio/podcast")
            return Redirect(doc.BlobUrl);

        var sasUrl = await _blobStorage.GetSasUrlAsync(doc.BlobUrl, expiryMinutes: 60, cancellationToken);
        return Redirect(sasUrl);
    }

    // GET /api/share/{token}/article  — anonymous, streams stored article HTML
    [HttpGet("{token}/article")]
    [AllowAnonymous]
    public async Task<IActionResult> GetArticle(string token, CancellationToken cancellationToken = default)
    {
        var share = await _unitOfWork.ShareTokens.GetByTokenAsync(token, cancellationToken);
        if (share == null || share.SourceType != "article" || share.SourceUrl == null)
            return NotFound();
        if (share.ExpiresAt.HasValue && share.ExpiresAt.Value < DateTime.UtcNow)
            return StatusCode(410, "Share link has expired");

        if (!TryParseDocPath(share.SourceUrl, out var docId))
            return NotFound();

        var doc = await _unitOfWork.Documents.GetByIdWithDetailsAsync(docId, cancellationToken);
        if (doc == null) return NotFound();

        var stream = await _blobStorage.DownloadAsync(doc.BlobUrl, cancellationToken);
        return File(stream, "text/plain; charset=utf-8");
    }

    // GET /api/share/{token}/file  — anonymous, streams document file through the server (avoids CORS)
    [HttpGet("{token}/file")]
    [AllowAnonymous]
    public async Task<IActionResult> StreamFile(string token, CancellationToken cancellationToken = default)
    {
        var share = await _unitOfWork.ShareTokens.GetByTokenAsync(token, cancellationToken);
        if (share == null || share.SourceType != "document" || share.SourceUrl == null)
            return NotFound();
        if (share.ExpiresAt.HasValue && share.ExpiresAt.Value < DateTime.UtcNow)
            return StatusCode(410, "Share link has expired");

        if (!TryParseDocPath(share.SourceUrl, out var docId))
            return NotFound();

        var doc = await _unitOfWork.Documents.GetByIdWithDetailsAsync(docId, cancellationToken);
        if (doc == null) return NotFound();

        var stream = await _blobStorage.DownloadAsync(doc.BlobUrl, cancellationToken);
        var contentType = string.IsNullOrWhiteSpace(doc.ContentType) ? "application/octet-stream" : doc.ContentType;
        return File(stream, contentType);
    }

    // GET /api/share/{token}/video — anonymous, streams an uploaded video shared by its owner
    [HttpGet("{token}/video")]
    [AllowAnonymous]
    public async Task<IActionResult> StreamVideo(string token, CancellationToken cancellationToken = default)
    {
        var share = await _unitOfWork.ShareTokens.GetByTokenAsync(token, cancellationToken);
        if (share == null || share.SourceType != "upload" || share.SourceUrl == null)
            return NotFound();
        if (share.ExpiresAt.HasValue && share.ExpiresAt.Value < DateTime.UtcNow)
            return StatusCode(410, "Share link has expired");

        if (!TryParseVideoPath(share.SourceUrl, out var videoId))
            return NotFound();

        var video = await _unitOfWork.YouTubeVideos.GetByIdAsync(videoId, cancellationToken);
        if (video == null || video.UserId != share.OwnerId || video.SourceType != "upload")
            return NotFound();

        var stream = await _blobStorage.DownloadAsync(video.VideoUrl, cancellationToken);
        return File(stream, MediaFormatting.GetVideoContentType(video.VideoUrl), enableRangeProcessing: true);
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
