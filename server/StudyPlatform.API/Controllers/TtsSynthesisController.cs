using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/tts")]
[Authorize]
[Produces("application/json")]
public class TtsSynthesisController : ControllerBase
{
    private const string DefaultVoice = "en-US-AriaNeural";

    [HttpPost("synthesize")]
    [ProducesResponseType(typeof(FileContentResult), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Synthesize(
        [FromBody] TtsSynthesizeRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest("Text is required.");

        var voice = string.IsNullOrWhiteSpace(request.Voice) ? DefaultVoice : request.Voice.Trim();
        var textFile = Path.GetTempFileName();
        var audioFile = Path.ChangeExtension(Path.GetTempFileName(), ".mp3");

        try
        {
            // Write text to a file to avoid any shell injection
            await System.IO.File.WriteAllTextAsync(textFile, request.Text, cancellationToken);

            var psi = new ProcessStartInfo
            {
                FileName = "edge-tts",
                ArgumentList = { "--voice", voice, "--file", textFile, "--write-media", audioFile },
                RedirectStandardError = true,
                UseShellExecute = false,
            };

            using var process = new Process { StartInfo = psi };
            process.Start();
            var stderr = await process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);

            if (process.ExitCode != 0)
                return StatusCode(500, $"TTS error: {stderr.Trim()}");

            if (!System.IO.File.Exists(audioFile))
                return StatusCode(500, "TTS produced no output file.");

            var bytes = await System.IO.File.ReadAllBytesAsync(audioFile, cancellationToken);
            return File(bytes, "audio/mpeg");
        }
        finally
        {
            if (System.IO.File.Exists(textFile)) System.IO.File.Delete(textFile);
            if (System.IO.File.Exists(audioFile)) System.IO.File.Delete(audioFile);
        }
    }
}

public record TtsSynthesizeRequest(string Text, string? Voice);
