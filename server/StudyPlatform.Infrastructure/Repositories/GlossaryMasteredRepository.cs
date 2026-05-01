using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class GlossaryMasteredRepository : IGlossaryMasteredRepository
{
    private readonly AppDbContext _context;

    public GlossaryMasteredRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Guid>> GetMasteredTermIdsByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _context.GlossaryMastered
            .Where(m => m.UserId == userId)
            .Select(m => m.GlossaryTermId)
            .ToListAsync(cancellationToken);

    public async Task<GlossaryMastered?> GetByUserAndTermAsync(Guid userId, Guid termId, CancellationToken cancellationToken = default)
        => await _context.GlossaryMastered
            .FirstOrDefaultAsync(m => m.UserId == userId && m.GlossaryTermId == termId, cancellationToken);

    public async Task AddAsync(GlossaryMastered mastered, CancellationToken cancellationToken = default)
        => await _context.GlossaryMastered.AddAsync(mastered, cancellationToken);

    public void Remove(GlossaryMastered mastered)
        => _context.GlossaryMastered.Remove(mastered);
}
