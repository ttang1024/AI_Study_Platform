using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Videos.Transcripts;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Services;

/// <summary><see cref="ITranscriptSegmentStore"/> over the <c>VideoTranscriptEntries</c> table.</summary>
public sealed class TranscriptSegmentStore : ITranscriptSegmentStore
{
    private static readonly JsonSerializerOptions ReadOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly AppDbContext _db;

    public TranscriptSegmentStore(AppDbContext db) => _db = db;

    public async Task<List<TranscriptSegmentDto>?> GetAsync(string videoKey, string kind, CancellationToken cancellationToken)
    {
        var entry = await _db.VideoTranscriptEntries.FindAsync([EntryKey(videoKey), kind], cancellationToken);
        if (entry is null)
            return null;

        if (entry.ExpiresAt <= DateTime.UtcNow)
        {
            _db.VideoTranscriptEntries.Remove(entry);
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<List<TranscriptSegmentDto>>(entry.SegmentsJson, ReadOptions);
        }
        catch
        {
            // Unreadable (an older shape): drop it so the next read refetches.
            _db.VideoTranscriptEntries.Remove(entry);
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }
    }

    public async Task UpsertAsync(
        string videoKey, string kind, IReadOnlyCollection<TranscriptSegmentDto> segments, TimeSpan ttl, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var expiresAt = now.Add(ttl);
        var segmentsJson = JsonSerializer.Serialize(segments);
        var entryKey = EntryKey(videoKey);

        await _db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "VideoTranscriptEntries" ("VideoId", "Kind", "SegmentsJson", "ExpiresAt", "CreatedAt", "UpdatedAt")
            VALUES ({entryKey}, {kind}, {segmentsJson}, {expiresAt}, {now}, {now})
            ON CONFLICT ("VideoId", "Kind") DO UPDATE
            SET "SegmentsJson" = EXCLUDED."SegmentsJson",
                "ExpiresAt" = EXCLUDED."ExpiresAt",
                "UpdatedAt" = EXCLUDED."UpdatedAt";
            """, cancellationToken);
    }

    // The key column is 32 chars; longer keys (full external URLs) are hashed to fit.
    private static string EntryKey(string videoKey)
    {
        if (videoKey.Length <= 32)
            return videoKey;

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(videoKey));
        return Convert.ToHexString(hash).ToLowerInvariant()[..32];
    }
}
