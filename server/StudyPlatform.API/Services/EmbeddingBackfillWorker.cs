using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.API.Services;

/// <summary>
/// Keeps the semantic index in step with the library. This sweeps for unindexed and stale content
/// instead of hooking every command that can write text: content arrives from a dozen paths (upload,
/// transcription, AI generation, clipper, import), several of them asynchronous, and a sweep also
/// picks up everything that already existed before embeddings were switched on.
/// </summary>
public sealed class EmbeddingBackfillWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEmbeddingService _embeddings;
    private readonly EmbeddingOptions _options;
    private readonly ILogger<EmbeddingBackfillWorker> _logger;

    public EmbeddingBackfillWorker(
        IServiceScopeFactory scopeFactory,
        IEmbeddingService embeddings,
        IOptions<EmbeddingOptions> options,
        ILogger<EmbeddingBackfillWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _embeddings = embeddings;
        _options = options.Value;
        _logger = logger;
    }

    private sealed record IndexCandidate(Guid UserId, string SourceType, Guid SourceId, string Title, string Text);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_embeddings.IsEnabled)
        {
            _logger.LogInformation("Embeddings are not configured; semantic search is disabled and no backfill will run.");
            return;
        }

        // Let migrations and the rest of startup settle before touching the database.
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        var interval = TimeSpan.FromMinutes(Math.Max(1, _options.BackfillIntervalMinutes));
        using var timer = new PeriodicTimer(interval);

        do
        {
            try
            {
                var (indexed, pruned) = await RunSweepAsync(stoppingToken);
                if (indexed > 0 || pruned > 0)
                    _logger.LogInformation(
                        "Embedding backfill indexed {Count} source(s) and pruned {Pruned} orphaned chunk(s)",
                        indexed, pruned);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // A bad sweep (provider down, one poisoned document) must not kill the worker for good.
                _logger.LogError(ex, "Embedding backfill sweep failed; retrying next interval");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task<(int Indexed, int Pruned)> RunSweepAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var index = scope.ServiceProvider.GetRequiredService<IEmbeddingIndex>();

        // Delete paths prune their own user's chunks, so this is the backstop: content deleted while
        // embeddings were switched off, chunks left behind by a failed prune, and anything deleted
        // straight out of the database.
        var pruned = await index.PruneOrphansAsync(cancellationToken: cancellationToken);

        var candidates = await FindStaleAsync(db, cancellationToken);

        var indexed = 0;
        foreach (var candidate in candidates)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                await index.IndexSourceAsync(
                    candidate.UserId,
                    candidate.SourceType,
                    candidate.SourceId,
                    candidate.Title,
                    candidate.Text,
                    cancellationToken);
                indexed++;
            }
            catch (Exception ex)
            {
                // One unindexable source shouldn't stall the rest of the sweep.
                _logger.LogWarning(ex, "Failed to index {SourceType} {SourceId}", candidate.SourceType, candidate.SourceId);
            }
        }

        return (indexed, pruned);
    }

    /// <summary>
    /// Content that has no chunks for the current embedding model, or whose text has moved on since it
    /// was last indexed. Only Document and Note carry an UpdatedAt; for Video and GlossaryTerm the
    /// absence check carries the load, which is why sources with no text yet are skipped rather than
    /// indexed empty — a video still awaiting its transcript stays a candidate until the transcript lands.
    /// </summary>
    private async Task<List<IndexCandidate>> FindStaleAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var model = _embeddings.Model;
        var budget = Math.Max(1, _options.BackfillBatchSize);
        var candidates = new List<IndexCandidate>();

        var documents = await db.Documents
            .AsNoTracking()
            .Where(d => (d.Transcript != null && d.Transcript != "") || (d.Summary != null && d.Summary != ""))
            .Where(d => !db.ContentEmbeddings.Any(e =>
                e.SourceType == EmbeddingSourceTypes.Document && e.SourceId == d.DocumentId && e.Model == model && e.CreatedAt >= d.UpdatedAt))
            .OrderBy(d => d.UpdatedAt)
            .Take(budget)
            .Select(d => new IndexCandidate(d.UserId, EmbeddingSourceTypes.Document, d.DocumentId, d.FileName, d.Transcript ?? d.Summary!))
            .ToListAsync(cancellationToken);
        candidates.AddRange(documents);

        var notes = await db.Notes
            .AsNoTracking()
            .Where(n => n.Content != "")
            .Where(n => !db.ContentEmbeddings.Any(e =>
                e.SourceType == EmbeddingSourceTypes.Note && e.SourceId == n.NoteId && e.Model == model && e.CreatedAt >= n.UpdatedAt))
            .OrderBy(n => n.UpdatedAt)
            .Take(budget)
            .Select(n => new IndexCandidate(n.UserId, EmbeddingSourceTypes.Note, n.NoteId, n.Title ?? "Note", n.Content))
            .ToListAsync(cancellationToken);
        candidates.AddRange(notes);

        var videos = await db.Videos
            .AsNoTracking()
            .Where(v => (v.Transcript != null && v.Transcript != "") || (v.Summary != null && v.Summary != ""))
            .Where(v => !db.ContentEmbeddings.Any(e =>
                e.SourceType == EmbeddingSourceTypes.Video && e.SourceId == v.VideoId && e.Model == model))
            .Take(budget)
            .Select(v => new IndexCandidate(v.UserId, EmbeddingSourceTypes.Video, v.VideoId, v.Title, v.Transcript ?? v.Summary!))
            .ToListAsync(cancellationToken);
        candidates.AddRange(videos);

        var terms = await db.GlossaryTerms
            .AsNoTracking()
            .Where(t => t.Definition != "")
            .Where(t => !db.ContentEmbeddings.Any(e =>
                e.SourceType == EmbeddingSourceTypes.Glossary && e.SourceId == t.GlossaryTermId && e.Model == model))
            .Take(budget)
            .Select(t => new IndexCandidate(t.UserId, EmbeddingSourceTypes.Glossary, t.GlossaryTermId, t.Term, t.Term + ": " + t.Definition))
            .ToListAsync(cancellationToken);
        candidates.AddRange(terms);

        return candidates;
    }
}
