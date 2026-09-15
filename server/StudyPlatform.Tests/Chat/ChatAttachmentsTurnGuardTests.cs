using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using Xunit;

namespace StudyPlatform.Tests.Chat;

/// <summary>
/// The guard every chat endpoint opens with. It decides a turn is well-formed before anything is
/// persisted or streamed, so the three endpoints reject the same inputs the same way.
/// </summary>
public class ChatAttachmentsTurnGuardTests
{
    private static readonly string PngBase64 = Convert.ToBase64String([1, 2, 3, 4]);

    private static ChatAttachmentDto Png(string? data = null, string mime = "image/png", string? name = "a.png")
        => new(mime, data ?? PngBase64, name);

    private static string? ErrorCode(IActionResult? result)
        => ((result as BadRequestObjectResult)?.Value as BaseResponse<string>)?.ErrorCode;

    [Fact]
    public void TryDecodeTurn_TextOnly_IsAccepted()
    {
        var problem = ChatAttachments.TryDecodeTurn(null, "Hello", out var list, out var attachments);

        Assert.Null(problem);
        Assert.Empty(list);
        Assert.Empty(attachments);
    }

    [Fact]
    public void TryDecodeTurn_AttachmentOnly_IsAccepted()
    {
        var problem = ChatAttachments.TryDecodeTurn([Png()], null, out var list, out var attachments);

        Assert.Null(problem);
        Assert.Single(list);
        var (data, mimeType, fileName) = Assert.Single(attachments);
        Assert.Equal([1, 2, 3, 4], data);
        Assert.Equal("image/png", mimeType);
        Assert.Equal("a.png", fileName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void TryDecodeTurn_NeitherTextNorAttachments_IsRejected(string? message)
    {
        var problem = ChatAttachments.TryDecodeTurn(null, message, out var list, out var attachments);

        Assert.Equal("MISSING_MESSAGE", ErrorCode(problem));
        Assert.Empty(list);
        Assert.Empty(attachments);
    }

    [Fact]
    public void TryDecodeTurn_UnsupportedAttachmentType_IsRejected()
    {
        var problem = ChatAttachments.TryDecodeTurn(
            [Png(mime: "application/zip")], "Look", out _, out var attachments);

        Assert.Equal("INVALID_ATTACHMENT", ErrorCode(problem));
        Assert.Empty(attachments);
    }

    [Fact]
    public void TryDecodeTurn_MalformedBase64_IsRejected()
    {
        var problem = ChatAttachments.TryDecodeTurn([Png(data: "not base64!!")], "Look", out _, out _);

        Assert.Equal("INVALID_ATTACHMENT", ErrorCode(problem));
    }

    [Fact]
    public void TryDecodeTurn_ReportsTheAttachmentListEvenWhenItIsRejected()
    {
        // AiController titles an attachment-only thread from the first file name.
        ChatAttachments.TryDecodeTurn([Png(name: "notes.png")], "Look", out var list, out _);

        Assert.Equal("notes.png", Assert.Single(list).FileName);
    }

    [Fact]
    public void Decode_NormalisesTheJpegAlias()
    {
        var attachments = ChatAttachments.Decode([Png(mime: "image/jpg", name: "a.jpg")]);

        Assert.Equal("image/jpeg", Assert.Single(attachments).mimeType);
    }

    [Fact]
    public void Decode_ToleratesADataUrlPrefix()
    {
        var attachments = ChatAttachments.Decode([Png(data: $"data:image/png;base64,{PngBase64}")]);

        Assert.Equal([1, 2, 3, 4], Assert.Single(attachments).data);
    }

    [Fact]
    public void Decode_RejectsAnEmptyAttachment()
        => Assert.Throws<ArgumentException>(() => ChatAttachments.Decode([Png(data: "")]));

    [Fact]
    public void Decode_RejectsMoreThanEightAttachments()
    {
        var nine = Enumerable.Range(0, 9).Select(_ => Png()).ToList();

        Assert.Throws<ArgumentException>(() => ChatAttachments.Decode(nine));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void PromptOrDefault_AnAttachmentOnlyTurnStillInstructsTheModel(string? message)
        => Assert.Equal("Please look at the attached file(s).", ChatAttachments.PromptOrDefault(message));

    [Fact]
    public void PromptOrDefault_KeepsARealMessage()
        => Assert.Equal("Explain this", ChatAttachments.PromptOrDefault("Explain this"));
}
