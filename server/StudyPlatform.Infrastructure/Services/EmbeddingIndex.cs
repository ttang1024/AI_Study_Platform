using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// The store behind semantic search: chunks in, nearest-neighbours out. Every method degrades to a
/// no-op (or an empty result) when embeddings are unconfigured, so callers can treat semantic search
/// as an optional enhancement rather than branching on it.
/// </summary>
public class EmbeddingIndex : IEmbeddingIndex
{
    private readonly AppDbContext _context;
    private readonly IEmbeddingService _embeddings;
    private readonly ILogger<EmbeddingIndex> _logger;

    public EmbeddingIndex(AppDbContext context, IEmbeddingService embeddings, ILogger<EmbeddingIndex> logger)
    {
        _context = context;
        _embeddings = embeddings;
        _logger = logger;
    }

    public static string HashSource(string text)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant();

    public async Task IndexSourceAsync(
        Guid userId,
        string sourceType,
        Guid sourceId,
        string title,
        string text,
        CancellationToken cancellationToken = default)
    {
        if (!_embeddings.IsEnabled || string.IsNullOrWhiteSpace(text))
            return;

        var hash = HashSource(text);

        // A source can look stale (its UpdatedAt moved) without its text having actually changed — a
        // rename, a re-save. Re-embedding it would be a pure waste of tokens, so stamp the existing
        // chunks as fresh and stop.
        var existing = await _context.ContentEmbeddings
            .Where(e => e.SourceType == sourceType && e.SourceId == sourceId && e.Model == _embeddings.Model)
            .Select(e => e.SourceHash)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing == hash)
        {
            await _context.ContentEmbeddings
                .Where(e => e.SourceType == sourceType && e.SourceId == sourceId)
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, DateTime.UtcNow), cancellationToken);
            return;
        }

        var chunks = ContentChunker.Chunk(text);
        if (chunks.Count == 0)
            return;

        var vectors = await _embeddings.EmbedAsync(chunks, cancellationToken);
        if (vectors.Count != chunks.Count)
        {
            _logger.LogWarning(
                "Embeddings returned {Vectors} vectors for {Chunks} chunks of {SourceType} {SourceId}; skipping index",
                vectors.Count, chunks.Count, sourceType, sourceId);
            return;
        }

        var now = DateTime.UtcNow;

        // Replace rather than merge: chunk boundaries move when the text changes, so stale chunks from
        // the previous revision cannot be matched up and would otherwise linger as phantom search hits.
        await RemoveSourceAsync(sourceType, sourceId, cancellationToken);

        for (var i = 0; i < chunks.Count; i++)
        {
            _context.ContentEmbeddings.Add(new ContentEmbedding
            {
                ContentEmbeddingId = Guid.NewGuid(),
                UserId = userId,
                SourceType = sourceType,
                SourceId = sourceId,
                Title = Truncate(title, 500),
                ChunkIndex = i,
                Text = chunks[i],
                Embedding = new Vector(vectors[i]),
                SourceHash = hash,
                Model = _embeddings.Model,
                CreatedAt = now,
            });
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveSourceAsync(string sourceType, Guid sourceId, CancellationToken cancellationToken = default)
        => await _context.ContentEmbeddings
            .Where(e => e.SourceType == sourceType && e.SourceId == sourceId)
            .ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<EmbeddingHit>> SearchAsync(
        Guid userId,
        string query,
        IReadOnlyCollection<string> sourceTypes,
        int limit,
        CancellationToken cancellationToken = default)
    {
        if (!_embeddings.IsEnabled || string.IsNullOrWhiteSpace(query) || sourceTypes.Count == 0)
            return [];

        float[] queryVector;
        try
        {
            queryVector = await _embeddings.EmbedOneAsync(query, cancellationToken);
        }
        catch (Exception ex)
        {
            // Search must never fail because the embeddings provider did — the caller still has keyword hits.
            _logger.LogWarning(ex, "Failed to embed search query; falling back to keyword search only");
            return [];
        }

        var vector = new Vector(queryVector);
        var types = sourceTypes.ToArray();

        // Ordering by <=> (cosine distance) is what the HNSW index accelerates. Only vectors from the
        // current model are comparable, so rows left behind by a model change are filtered out.
        return await _context.ContentEmbeddings
            .AsNoTracking()
            .Where(e => e.UserId == userId && types.Contains(e.SourceType) && e.Model == _embeddings.Model)
            .OrderBy(e => e.Embedding.CosineDistance(vector))
            .Take(limit)
            .Select(e => new EmbeddingHit(
                e.SourceType,
                e.SourceId,
                e.Title,
                e.Text,
                e.ChunkIndex,
                e.Embedding.CosineDistance(vector)))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EmbeddingHit>> FindNearestAsync(
        Guid userId,
        float[] vector,
        string sourceType,
        int limit,
        CancellationToken cancellationToken = default)
    {
        if (!_embeddings.IsEnabled || vector.Length == 0)
            return [];

        var probe = new Vector(vector);

        return await _context.ContentEmbeddings
            .AsNoTracking()
            .Where(e => e.UserId == userId && e.SourceType == sourceType && e.Model == _embeddings.Model)
            .OrderBy(e => e.Embedding.CosineDistance(probe))
            .Take(limit)
            .Select(e => new EmbeddingHit(
                e.SourceType,
                e.SourceId,
                e.Title,
                e.Text,
                e.ChunkIndex,
                e.Embedding.CosineDistance(probe)))
            .ToListAsync(cancellationToken);
    }

    private static string Truncate(string value, int max)
        => value.Length <= max ? value : value[..max];
}
