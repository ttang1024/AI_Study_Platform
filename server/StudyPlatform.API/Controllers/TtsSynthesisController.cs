using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/tts")]
[Authorize]
[Produces("application/json")]
public class TtsSynthesisController : ControllerBase
{
    private readonly ISpeechSynthesizer _synthesizer;

    public TtsSynthesisController(ISpeechSynthesizer synthesizer) => _synthesizer = synthesizer;

    [HttpPost("synthesize")]
    [ProducesResponseType(typeof(FileContentResult), 200)]
    [ProducesResponseType(typeof(BaseResponse<string>), 400)]
    [ProducesResponseType(typeof(BaseResponse<string>), 502)]
    public async Task<IActionResult> Synthesize([FromBody] TtsSynthesizeRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(BaseResponse<string>.Fail("Text is required.", "MISSING_TEXT"));
        if (request.Text.Length > SpeechRequests.MaxTextChars)
            return BadRequest(BaseResponse<string>.Fail($"Text is limited to {SpeechRequests.MaxTextChars} characters per request.", "TEXT_TOO_LONG"));

        var voice = string.IsNullOrWhiteSpace(request.Voice) ? SpeechRequests.DefaultVoice : request.Voice.Trim();
        if (!SpeechRequests.IsValidVoice(voice))
            return BadRequest(BaseResponse<string>.Fail("Unknown voice.", "INVALID_VOICE"));

        try
        {
            return File(await _synthesizer.SynthesizeAsync(request.Text, voice, cancellationToken), "audio/mpeg");
        }
        catch (InvalidOperationException)
        {
            // The synthesizer logs the tool's own error; the client only needs to know it failed.
            return StatusCode(StatusCodes.Status502BadGateway, BaseResponse<string>.Fail("Speech synthesis failed. Please try again.", "TTS_FAILED"));
        }
    }
}

public record TtsSynthesizeRequest(string Text, string? Voice);
