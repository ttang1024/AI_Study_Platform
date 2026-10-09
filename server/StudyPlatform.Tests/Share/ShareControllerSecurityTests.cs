using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using StudyPlatform.API.Controllers;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Share.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Share;

/// <summary>
/// A share is public: its notes are rendered as HTML by anyone who opens the link, and its source path
/// decides which file the anonymous media endpoints stream. Both must stay within what the creator owns.
/// </summary>
public class ShareControllerSecurityTests
{
    private static readonly Guid Owner = Guid.NewGuid();
    private static readonly Guid Stranger = Guid.NewGuid();

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IShareTokenRepository> _shares = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IBlobStorageService> _blobs = new();
    private ShareToken? _saved;

    public ShareControllerSecurityTests()
    {
        _uow.Setup(u => u.ShareTokens).Returns(_shares.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _shares.Setup(r => r.AddAsync(It.IsAny<ShareToken>(), It.IsAny<CancellationToken>()))
            .Callback<ShareToken, CancellationToken>((s, _) => _saved = s);
    }

    private ShareController CreateController(Guid? userId)
    {
        var controller = new ShareController(_uow.Object, _blobs.Object, new RichTextSanitizer());
        var identity = userId is { } id
            ? new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id.ToString())], "test")
            : new ClaimsIdentity();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
        return controller;
    }

    private static CreateShareRequest Request(
        string? notesHtml = null, string? sourceType = null, string? sourceUrl = null)
        => new("Title", null, null, notesHtml, null, null, null, null, sourceType, sourceUrl);

    // ── Source ownership ─────────────────────────────────────────────────

    [Fact]
    public async Task CreateShare_DocumentTheCallerDoesNotOwn_IsRejected()
    {
        var docId = Guid.NewGuid();
        _documents.Setup(r => r.GetSourceRefAsync(docId, Stranger, It.IsAny<CancellationToken>()))
            .ReturnsAsync((DocumentSourceRef?)null);

        var result = await CreateController(Stranger)
            .CreateShare(Request(sourceType: "document", sourceUrl: $"{Guid.NewGuid()}/{docId}"));

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("SOURCE_NOT_OWNED", Assert.IsType<BaseResponse<CreateShareResponse>>(bad.Value).ErrorCode);
        _shares.Verify(r => r.AddAsync(It.IsAny<ShareToken>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateShare_OwnDocument_IsSaved()
    {
        var docId = Guid.NewGuid();
        _documents.Setup(r => r.GetSourceRefAsync(docId, Owner, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DocumentSourceRef("application/pdf", "blob"));

        var result = await CreateController(Owner)
            .CreateShare(Request(sourceType: "document", sourceUrl: $"{Guid.NewGuid()}/{docId}"));

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(Owner, _saved!.OwnerId);
    }

    [Fact]
    public async Task CreateShare_UploadedVideoTheCallerDoesNotOwn_IsRejected()
    {
        var videoId = Guid.NewGuid();
        _videos.Setup(r => r.GetByIdAsync(videoId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Video { VideoId = videoId, UserId = Owner });

        var result = await CreateController(Stranger)
            .CreateShare(Request(sourceType: "upload", sourceUrl: $"video/{videoId}"));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CreateShare_ExternalUrl_NeedsNoOwnershipCheck()
    {
        var result = await CreateController(Stranger)
            .CreateShare(Request(sourceType: "youtube", sourceUrl: "https://www.youtube.com/watch?v=abc"));

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task StreamFile_ShareNamingAnotherUsersDocument_IsNotFound()
    {
        // A share row written before the create-time check existed, pointing at someone else's file.
        var docId = Guid.NewGuid();
        _shares.Setup(r => r.GetByTokenAsync("t", It.IsAny<CancellationToken>())).ReturnsAsync(new ShareToken
        {
            Token = "t", OwnerId = Stranger, SourceType = "document", SourceUrl = $"{Guid.NewGuid()}/{docId}",
        });
        _documents.Setup(r => r.GetSourceRefAsync(docId, Owner, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DocumentSourceRef("application/pdf", "victim-blob"));

        var result = await CreateController(null).StreamFile("t");

        Assert.IsType<NotFoundResult>(result);
        _blobs.Verify(b => b.DownloadAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task StreamFile_IsServedAsAnInertDownload()
    {
        var docId = Guid.NewGuid();
        _shares.Setup(r => r.GetByTokenAsync("t", It.IsAny<CancellationToken>())).ReturnsAsync(new ShareToken
        {
            Token = "t", OwnerId = Owner, SourceType = "document", SourceUrl = $"{Guid.NewGuid()}/{docId}",
        });
        _documents.Setup(r => r.GetSourceRefAsync(docId, Owner, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DocumentSourceRef("text/html", "blob"));
        _blobs.Setup(b => b.DownloadAsync("blob", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MemoryStream("<script>alert(1)</script>"u8.ToArray()));

        var controller = CreateController(null);
        await controller.StreamFile("t");

        var headers = controller.Response.Headers;
        Assert.Equal("attachment", headers.ContentDisposition.ToString());
        Assert.Equal("nosniff", headers.XContentTypeOptions.ToString());
        Assert.Contains("sandbox", headers.ContentSecurityPolicy.ToString());
    }

    [Fact]
    public async Task StreamVideo_RedirectsToStorage_WithAServerChosenContentType()
    {
        var videoId = Guid.NewGuid();
        _shares.Setup(r => r.GetByTokenAsync("t", It.IsAny<CancellationToken>())).ReturnsAsync(new ShareToken
        {
            Token = "t", OwnerId = Owner, SourceType = "upload", SourceUrl = $"video/{videoId}",
        });
        _videos.Setup(r => r.GetByIdAsync(videoId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Video { VideoId = videoId, UserId = Owner, SourceType = "upload", VideoUrl = "s3://b/v.mp4" });
        _blobs.Setup(b => b.GetMediaUrlAsync("s3://b/v.mp4", "video/mp4", It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://signed/v.mp4");

        var result = await CreateController(null).StreamVideo("t");

        Assert.Equal("https://signed/v.mp4", Assert.IsType<RedirectResult>(result).Url);
        _blobs.Verify(b => b.DownloadAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ── Notes sanitization ───────────────────────────────────────────────

    [Fact]
    public async Task CreateShare_StripsScriptFromNotes()
    {
        await CreateController(Owner).CreateShare(Request(
            notesHtml: "<p>Hi<img src=x onerror=\"alert(1)\"><script>steal()</script></p>"));

        Assert.Contains("<p>Hi", _saved!.NotesHtml);
        Assert.DoesNotContain("onerror", _saved.NotesHtml);
        Assert.DoesNotContain("<script", _saved.NotesHtml);
    }

    [Fact]
    public async Task CreateShare_ChatTranscriptJson_IsKeptVerbatim()
    {
        const string transcript = "{\"type\":\"chat-transcript\",\"messages\":[{\"role\":\"user\",\"content\":\"is a < b?\"}]}";

        await CreateController(Owner).CreateShare(Request(notesHtml: transcript, sourceType: "chat"));

        Assert.Equal(transcript, _saved!.NotesHtml);
    }

    [Fact]
    public async Task CreateShare_JsonOutsideAChatShare_IsStillSanitized()
    {
        // Non-chat notes are rendered as HTML whatever they look like, so JSON earns no exemption there.
        await CreateController(Owner).CreateShare(Request(
            notesHtml: "{\"type\":\"chat-transcript\",\"x\":\"<img src=x onerror=alert(1)>\"}",
            sourceType: "document"));

        Assert.DoesNotContain("onerror", _saved!.NotesHtml);
    }

    [Fact]
    public async Task GetShare_SanitizesNotesStoredBeforeSanitizationExisted()
    {
        _shares.Setup(r => r.GetByTokenAsync("t", It.IsAny<CancellationToken>())).ReturnsAsync(new ShareToken
        {
            Token = "t", OwnerId = Owner, Title = "x", CreatedAt = DateTime.UtcNow,
            NotesHtml = "<b>ok</b><svg onload=alert(1)></svg>",
        });

        var result = await CreateController(null).GetShare("t");

        var dto = Assert.IsType<BaseResponse<ShareDto>>(Assert.IsType<OkObjectResult>(result).Value).Data!;
        Assert.Contains("<b>ok</b>", dto.NotesHtml);
        Assert.DoesNotContain("onload", dto.NotesHtml);
    }
}
