using System.Diagnostics;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Shells out to the edge-tts CLI (same engine the read-aloud endpoint uses).
/// Text goes through a temp file so nothing user-controlled touches the argument list.
/// </summary>
public class EdgeTtsService : ITtsSynthesisService
{
    public async Task<byte[]> SynthesizeAsync(string text, string voice, CancellationToken cancellationToken = default)
    {
        var textFile = Path.GetTempFileName();
        var audioFile = Path.ChangeExtension(Path.GetTempFileName(), ".mp3");
        try
        {
            await File.WriteAllTextAsync(textFile, text, cancellationToken);

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

            if (process.ExitCode != 0 || !File.Exists(audioFile))
                throw new InvalidOperationException($"edge-tts failed (exit {process.ExitCode}): {stderr.Trim()}");

            return await File.ReadAllBytesAsync(audioFile, cancellationToken);
        }
        finally
        {
            if (File.Exists(textFile)) File.Delete(textFile);
            if (File.Exists(audioFile)) File.Delete(audioFile);
        }
    }
}
