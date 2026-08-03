using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class LibraryTagRepository : Repository<LibraryTag>, ILibraryTagRepository
{
    public LibraryTagRepository(AppDbContext context) : base(context) { }

    public async Task<IReadOnlyList<LibraryTagWithCount>> GetForUserAsync(
        Guid userId, string? kind, CancellationToken cancellationToken = default)
    {
        var query = _dbSet.AsNoTracking().Where(t => t.UserId == userId);

        if (!string.IsNullOrWhiteSpace(kind))
            query = query.Where(t => t.Kind == kind);

        var tags = await query.OrderBy(t => t.Name).ToListAsync(cancellationToken);
        if (tags.Count == 0)
            return Array.Empty<LibraryTagWithCount>();

        var tagIds = tags.Select(t => t.LibraryTagId).ToList();

        // Counted against live items. The join is polymorphic and has no cascade, so an assignment
        // can outlive its document — counting rows in the join alone would show a folder holding
        // things the user already deleted.
        var counts = await _context.LibraryTagAssignments
            .AsNoTracking()
            .Where(a => tagIds.Contains(a.LibraryTagId))
            .Where(a =>
                (a.ItemKind == "document" && _context.Documents.Any(d => d.DocumentId == a.ItemId)) ||
                (a.ItemKind == "video" && _context.Videos.Any(v => v.VideoId == a.ItemId)))
            .GroupBy(a => a.LibraryTagId)
            .Select(g => new { TagId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var byTag = counts.ToDictionary(c => c.TagId, c => c.Count);

        return tags
            .Select(t => new LibraryTagWithCount(t, byTag.GetValueOrDefault(t.LibraryTagId)))
            .ToList();
    }

    public async Task<LibraryTag?> GetByNameAsync(
        Guid userId, string name, string kind, CancellationToken cancellationToken = default)
        => await _dbSet.FirstOrDefaultAsync(
            t => t.UserId == userId && t.Kind == kind && t.Name.ToLower() == name.ToLower(),
            cancellationToken);

    public async Task<IReadOnlyDictionary<(string ItemKind, Guid ItemId), List<LibraryTag>>> GetAssignmentsAsync(
        Guid userId,
        IReadOnlyCollection<(string ItemKind, Guid ItemId)> items,
        CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<(string, Guid), List<LibraryTag>>();
        if (items.Count == 0)
            return result;

        // Matched on id alone, then filtered by kind in memory. A translatable predicate over pairs
        // would be a chain of ORs the length of the page; ids collide across the two tables only by
        // Guid coincidence, so this reads a couple of extra rows at worst and drops them immediately.
        var ids = items.Select(i => i.ItemId).Distinct().ToList();

        var rows = await _context.LibraryTagAssignments
            .AsNoTracking()
            .Where(a => ids.Contains(a.ItemId) && a.Tag.UserId == userId)
            .Select(a => new { a.ItemKind, a.ItemId, a.Tag })
            .ToListAsync(cancellationToken);

        var wanted = items.ToHashSet();

        foreach (var row in rows)
        {
            var key = (row.ItemKind, row.ItemId);
            if (!wanted.Contains(key))
                continue;

            if (!result.TryGetValue(key, out var list))
                result[key] = list = new List<LibraryTag>();

            list.Add(row.Tag);
        }

        foreach (var list in result.Values)
            list.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));

        return result;
    }

    public async Task<int> AssignAsync(
        Guid tagId,
        IReadOnlyCollection<(string ItemKind, Guid ItemId)> items,
        CancellationToken cancellationToken = default)
    {
        if (items.Count == 0)
            return 0;

        var ids = items.Select(i => i.ItemId).Distinct().ToList();

        var existing = (await _context.LibraryTagAssignments
                .Where(a => a.LibraryTagId == tagId && ids.Contains(a.ItemId))
                .Select(a => new { a.ItemKind, a.ItemId })
                .ToListAsync(cancellationToken))
            .Select(a => (a.ItemKind, a.ItemId))
            .ToHashSet();

        // Re-tagging something already tagged is a no-op, not an error: bulk-assign over a mixed
        // selection is the normal case, and half of it having the tag already should not fail.
        var toAdd = items
            .Distinct()
            .Where(i => !existing.Contains(i))
            .Select(i => new LibraryTagAssignment
            {
                LibraryTagId = tagId,
                ItemKind = i.ItemKind,
                ItemId = i.ItemId,
                AssignedAt = DateTime.UtcNow,
            })
            .ToList();

        if (toAdd.Count > 0)
            await _context.LibraryTagAssignments.AddRangeAsync(toAdd, cancellationToken);

        return toAdd.Count;
    }

    public async Task<int> UnassignAsync(
        Guid tagId,
        IReadOnlyCollection<(string ItemKind, Guid ItemId)> items,
        CancellationToken cancellationToken = default)
    {
        if (items.Count == 0)
            return 0;

        var ids = items.Select(i => i.ItemId).Distinct().ToList();

        var rows = await _context.LibraryTagAssignments
            .Where(a => a.LibraryTagId == tagId && ids.Contains(a.ItemId))
            .ToListAsync(cancellationToken);

        var wanted = items.ToHashSet();
        var doomed = rows.Where(r => wanted.Contains((r.ItemKind, r.ItemId))).ToList();

        _context.LibraryTagAssignments.RemoveRange(doomed);
        return doomed.Count;
    }

    public async Task RemoveAssignmentsForItemAsync(
        string itemKind, Guid itemId, CancellationToken cancellationToken = default)
        => await _context.LibraryTagAssignments
            .Where(a => a.ItemKind == itemKind && a.ItemId == itemId)
            .ExecuteDeleteAsync(cancellationToken);
}

public class SavedLibraryViewRepository : Repository<SavedLibraryView>, ISavedLibraryViewRepository
{
    public SavedLibraryViewRepository(AppDbContext context) : base(context) { }

    public async Task<IReadOnlyList<SavedLibraryView>> GetForUserAsync(
        Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(v => v.UserId == userId)
            .OrderBy(v => v.Position)
            .ThenBy(v => v.CreatedAt)
            .ToListAsync(cancellationToken);
}
