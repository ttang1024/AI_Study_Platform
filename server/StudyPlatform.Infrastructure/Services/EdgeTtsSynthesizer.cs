using System.Diagnostics;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// <see cref="ISpeechSynthesizer"/> over the <c>edge-tts</c> CLI (installed in the API image).
///
/// <para>Each request is a Python process sharing a small box with the API, so at most
/// <see cref="MaxConcurrent"/> run at once and the rest wait their turn (clients send a long text as
/// parallel chunks, so waiting beats refusing). A process that hangs is killed after
/// <see cref="ProcessTimeout"/>.</para>
/// </summary>
public sealed class EdgeTtsSynthesizer : ISpeechSynthesizer
{
    private const int MaxConcurrent = 3;
    private static readonly TimeSpan ProcessTimeout = TimeSpan.FromSeconds(90);

    private readonly SemaphoreSlim _slots = new(MaxConcurrent, MaxConcurrent);
    private readonly ILogger<EdgeTtsSynthesizer> _logger;

    public EdgeTtsSynthesizer(ILogger<EdgeTtsSynthesizer> logger) => _logger = logger;

    public async Task<byte[]> SynthesizeAsync(string text, string voice, CancellationToken cancellationToken)
    {
        await _slots.WaitAsync(cancellationToken);
        var workDir = Directory.CreateTempSubdirectory("tts-");
        try
        {
            // The text goes through a file, never the command line.
            var textFile = Path.Combine(workDir.FullName, "input.txt");
            var audioFile = Path.Combine(workDir.FullName, "output.mp3");
            await File.WriteAllTextAsync(textFile, text, cancellationToken);

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(ProcessTimeout);

            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "edge-tts",
                    ArgumentList = { "--voice", voice, "--file", textFile, "--write-media", audioFile },
                    RedirectStandardError = true,
                    UseShellExecute = false,
                },
            };
            process.Start();
            try
            {
                var stderr = await process.StandardError.ReadToEndAsync(timeout.Token);
                await process.WaitForExitAsync(timeout.Token);

                if (process.ExitCode != 0 || !File.Exists(audioFile))
                {
                    _logger.LogWarning("edge-tts exited {ExitCode}: {Error}", process.ExitCode, stderr.Trim());
                    throw new InvalidOperationException("Speech synthesis failed.");
                }
            }
            catch (OperationCanceledException)
            {
                process.Kill(entireProcessTree: true);
                throw;
            }

            return await File.ReadAllBytesAsync(audioFile, cancellationToken);
        }
        finally
        {
            _slots.Release();
            try
            {
                workDir.Delete(recursive: true);
            }
            catch (IOException ex)
            {
                _logger.LogWarning(ex, "Could not remove TTS work directory {Dir}", workDir.FullName);
            }
        }
    }
}
