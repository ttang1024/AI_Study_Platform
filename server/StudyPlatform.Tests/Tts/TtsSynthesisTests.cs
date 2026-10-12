using Microsoft.AspNetCore.Mvc;
using Moq;
using StudyPlatform.API.Controllers;
using StudyPlatform.Application.Services;
using Xunit;

namespace StudyPlatform.Tests.Tts;

public class TtsSynthesisTests
{
    private readonly Mock<ISpeechSynthesizer> _synthesizer = new();
    private TtsSynthesisController Controller => new(_synthesizer.Object);

    [Theory]
    [InlineData("en-US-AriaNeural", true)]
    [InlineData("zh-CN-shaanxi-XiaoniNeural", true)]
    [InlineData("en-US-AndrewMultilingualNeural", true)]
    [InlineData("--proxy=http://evil", false)]
    [InlineData("en-US-Aria", false)]
    [InlineData("../../etc/passwd", false)]
    public void VoiceIds_AreValidated(string voice, bool valid) => Assert.Equal(valid, SpeechRequests.IsValidVoice(voice));

    [Fact]
    public async Task OverlongText_IsRefusedBeforeSynthesis()
    {
        var result = await Controller.Synthesize(new TtsSynthesizeRequest(new string('a', SpeechRequests.MaxTextChars + 1), null), default);

        Assert.IsType<BadRequestObjectResult>(result);
        _synthesizer.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task SynthesizerFailure_IsA502_WithoutTheToolsOutput()
    {
        _synthesizer.Setup(s => s.SynthesizeAsync("hi", SpeechRequests.DefaultVoice, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Speech synthesis failed."));

        var result = Assert.IsType<ObjectResult>(await Controller.Synthesize(new TtsSynthesizeRequest("hi", null), default));

        Assert.Equal(502, result.StatusCode);
    }
}
