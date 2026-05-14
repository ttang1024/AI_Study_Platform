# Text To Speech

## Route

`TtsSynthesisController` is mounted at `/api/tts`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/tts/synthesize` | Generate speech audio from text |

## Implementation

`TtsSynthesisController` shells out to the `edge-tts` CLI. To avoid shell injection the input text is written to a temp file and passed via `--file` rather than as a command argument. The generated MP3 is read back into memory and returned as `audio/mpeg`; both temp files are deleted in the `finally` block.

```csharp
// TtsSynthesisController.cs
[HttpPost("synthesize")]
public async Task<IActionResult> Synthesize(
    [FromBody] TtsSynthesizeRequest request, CancellationToken cancellationToken)
{
    if (string.IsNullOrWhiteSpace(request.Text))
        return BadRequest("Text is required.");

    var voice     = string.IsNullOrWhiteSpace(request.Voice) ? DefaultVoice : request.Voice.Trim();
    var textFile  = Path.GetTempFileName();
    var audioFile = Path.ChangeExtension(Path.GetTempFileName(), ".mp3");

    try
    {
        // Write to a file — avoids any shell injection via the text content
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

        var bytes = await System.IO.File.ReadAllBytesAsync(audioFile, cancellationToken);
        return File(bytes, "audio/mpeg");
    }
    finally
    {
        if (System.IO.File.Exists(textFile))  System.IO.File.Delete(textFile);
        if (System.IO.File.Exists(audioFile)) System.IO.File.Delete(audioFile);
    }
}
```

Default voice is `en-US-AriaNeural`. The caller can override it via `request.Voice`.

## Frontend

TTS state is provided by `TtsContext`. UI and playback live in `TtsPlayer`, `useTts`, `ttsSettingsService.ts`, and `edgeTtsService.ts`.
