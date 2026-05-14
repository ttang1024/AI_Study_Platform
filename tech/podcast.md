# Podcast And Audio

## Podcast Routes

`PodcastController` is mounted at `/api/podcasts`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/podcasts` | Create/import podcast episode document |
| `GET` | `/api/podcasts/{documentId}` | Load podcast document |
| `GET` | `/api/podcasts/{documentId}/url` | Get audio URL |
| `POST` | `/api/podcasts/{documentId}/transcribe` | Transcribe podcast audio |

## Audio Routes

`AudioController` is mounted at `/api/courses/{courseId}/audio`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/upload` | Upload audio |
| `GET` | `/{documentId}` | Load audio document |
| `GET` | `/{documentId}/url` | Get audio URL |
| `POST` | `/{documentId}/transcribe` | Transcribe audio |

## Whisper Transcription Service

`WhisperTranscriptionService` is registered as a **singleton** because the Whisper model is expensive to load. The factory is initialised lazily on the first transcription request, with a `SemaphoreSlim(1)` ensuring only one thread downloads or loads the model even under concurrent startup.

```csharp
// WhisperTranscriptionService.cs — lazy thread-safe factory init
private async Task<WhisperFactory> GetFactoryAsync(CancellationToken ct)
{
    if (_factory != null) return _factory;

    await _initLock.WaitAsync(ct);
    try
    {
        if (_factory != null) return _factory;      // double-check after lock

        if (!File.Exists(_modelPath))
        {
            _logger.LogInformation("Downloading Whisper model {Model}...", _modelType);
            Directory.CreateDirectory(Path.GetDirectoryName(_modelPath)!);

            await using var modelStream =
                await WhisperGgmlDownloader.GetGgmlModelAsync(_modelType);
            await using var fileStream = File.Create(_modelPath);
            await modelStream.CopyToAsync(fileStream, ct);
        }

        _factory = WhisperFactory.FromPath(_modelPath);
        return _factory;
    }
    finally { _initLock.Release(); }
}
```

The model is selected via `Whisper:Model` config (`tiny`, `base`, `small`, `medium`, `large`; defaults to `base`) and stored under `Whisper:ModelsDir` (defaults to `whisper-models/` next to the assembly).

## Services

`ApplePodcastService` talks to Apple podcast APIs. `WhisperTranscriptionService` transcribes audio and is registered as a singleton.

## Frontend

`PodcastTab`, `AudioTab`, `AudioDetailPage`, `podcastService.ts`, and `audioService.ts`.
