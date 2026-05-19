using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;
using Whisper.net;
using Whisper.net.Ggml;

namespace StudyPlatform.Infrastructure.Services;

public sealed class WhisperTranscriptionService : ITranscriptionService, IDisposable
{
    private readonly ILogger<WhisperTranscriptionService> _logger;
    private readonly string _modelPath;
    private readonly GgmlType _modelType;
    private WhisperFactory? _factory;
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private readonly SemaphoreSlim _transcriptionLock = new(1, 1);

    public WhisperTranscriptionService(IConfiguration configuration, ILogger<WhisperTranscriptionService> logger)
    {
        _logger = logger;

        var modelsDir = configuration["Whisper:ModelsDir"]
            ?? Path.Combine(AppContext.BaseDirectory, "whisper-models");

        var modelName = configuration["Whisper:Model"] ?? "base";
        _modelType = modelName.ToLowerInvariant() switch
        {
            "tiny" => GgmlType.Tiny,
            "base" => GgmlType.Base,
            "small" => GgmlType.Small,
            "medium" => GgmlType.Medium,
            "large" => GgmlType.LargeV3,
            _ => GgmlType.Base
        };

        _modelPath = Path.Combine(modelsDir, $"ggml-{modelName}.bin");
    }

    // ── Factory (lazy, thread-safe) ──────────────────────────────────────────

    private async Task<WhisperFactory> GetFactoryAsync(CancellationToken cancellationToken)
    {
        if (_factory != null) return _factory;

        await _initLock.WaitAsync(cancellationToken);
        try
        {
            if (_factory != null) return _factory;

            if (!File.Exists(_modelPath))
            {
                _logger.LogInformation(
                    "Whisper model not found at {Path}. Downloading {Model}...",
                    _modelPath, _modelType);

                Directory.CreateDirectory(Path.GetDirectoryName(_modelPath)!);

                await using var modelStream =
                    await WhisperGgmlDownloader.GetGgmlModelAsync(_modelType);
                await using var fileStream = File.Create(_modelPath);
                await modelStream.CopyToAsync(fileStream, cancellationToken);

                _logger.LogInformation("Whisper model downloaded to {Path}.", _modelPath);
            }

            _factory = WhisperFactory.FromPath(_modelPath);
            return _factory;
        }
        finally
        {
            _initLock.Release();
        }
    }

    // ── Transcription ────────────────────────────────────────────────────────

    private const double ChunkSeconds = 30.0;

    public async Task<string> TranscribeAsync(
        byte[] audioData,
        string mimeType,
        CancellationToken cancellationToken = default)
    {
        await _transcriptionLock.WaitAsync(cancellationToken);
        try
        {
            var factory = await GetFactoryAsync(cancellationToken);

            // Whisper requires 16 kHz mono WAV - convert via FFmpeg.
            var wavData = await ConvertToWavAsync(audioData, mimeType, cancellationToken);

            using var processor = factory.CreateBuilder()
                .WithLanguage("auto")
                .Build();

            // Collect all Whisper segments (each is a sentence-level fragment with timestamps).
            var raw = new List<(double Start, double End, string Text)>();
            using var ms = new MemoryStream(wavData);

            await foreach (var seg in processor.ProcessAsync(ms, cancellationToken))
            {
                if (!string.IsNullOrWhiteSpace(seg.Text))
                    raw.Add((seg.Start.TotalSeconds, seg.End.TotalSeconds, seg.Text.Trim()));
            }

            var chunks = GroupIntoChunks(raw, ChunkSeconds);

            return JsonSerializer.Serialize(chunks, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
        }
        finally
        {
            _transcriptionLock.Release();
        }
    }

    private static List<TranscriptChunk> GroupIntoChunks(
        List<(double Start, double End, string Text)> segments,
        double chunkDuration)
    {
        var chunks = new List<TranscriptChunk>();
        if (segments.Count == 0) return chunks;

        var chunkStart = segments[0].Start;
        var chunkEnd = segments[0].End;
        var texts = new List<string>();

        foreach (var seg in segments)
        {
            if (seg.Start - chunkStart >= chunkDuration && texts.Count > 0)
            {
                chunks.Add(new TranscriptChunk(chunkStart, chunkEnd, string.Join(" ", texts)));
                chunkStart = seg.Start;
                texts.Clear();
            }
            texts.Add(seg.Text);
            chunkEnd = seg.End;
        }

        if (texts.Count > 0)
            chunks.Add(new TranscriptChunk(chunkStart, chunkEnd, string.Join(" ", texts)));

        return chunks;
    }

    private record TranscriptChunk(double Start, double End, string Text);

    // ── Audio conversion (FFmpeg) ────────────────────────────────────────────

    private async Task<byte[]> ConvertToWavAsync(
        byte[] audioData,
        string mimeType,
        CancellationToken cancellationToken)
    {
        // If already 16 kHz mono WAV we still run through FFmpeg to normalise,
        // but skip reading stderr unless there's a failure.
        var ext = MimeTypeToExtension(mimeType);
        var inputPath = Path.Combine(Path.GetTempPath(), $"whisper_in_{Guid.NewGuid()}{ext}");
        var outputPath = Path.Combine(Path.GetTempPath(), $"whisper_out_{Guid.NewGuid()}.wav");

        try
        {
            await File.WriteAllBytesAsync(inputPath, audioData, cancellationToken);

            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "ffmpeg",
                    // -ar 16000   → 16 kHz sample rate
                    // -ac 1       → mono
                    // pcm_s16le   → 16-bit PCM (required by Whisper)
                    Arguments = $"-y -i \"{inputPath}\" -ar 16000 -ac 1 -c:a pcm_s16le \"{outputPath}\"",
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                }
            };

            process.Start();
            var stderr = await process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);

            if (process.ExitCode != 0)
                throw new InvalidOperationException(
                    $"FFmpeg audio conversion failed (exit {process.ExitCode}): {stderr}");

            return await File.ReadAllBytesAsync(outputPath, cancellationToken);
        }
        finally
        {
            if (File.Exists(inputPath)) File.Delete(inputPath);
            if (File.Exists(outputPath)) File.Delete(outputPath);
        }
    }

    private static string MimeTypeToExtension(string mimeType) => mimeType switch
    {
        "audio/mpeg" or "audio/mp3" => ".mp3",
        "audio/mp4" or "audio/x-m4a" => ".m4a",
        "audio/wav" or "audio/x-wav" => ".wav",
        "audio/ogg" => ".ogg",
        "audio/aac" => ".aac",
        "audio/flac" => ".flac",
        "audio/webm" => ".webm",
        _ => ".audio",
    };

    public void Dispose()
    {
        _factory?.Dispose();
        _initLock.Dispose();
        _transcriptionLock.Dispose();
    }
}
