using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class AnalyticsRepository : IAnalyticsRepository
{
    private readonly AppDbContext _context;

    public AnalyticsRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<QuizAttempt>> GetQuizAttemptsByDateRangeAsync(Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default)
        => await _context.QuizAttempts
            .Where(a => a.UserId == userId && a.AttemptedAt >= from.Date && a.AttemptedAt < to.Date.AddDays(1))
            .ToListAsync(cancellationToken);

    public async Task AddQuizAttemptAsync(QuizAttempt attempt, CancellationToken cancellationToken = default)
        => await _context.QuizAttempts.AddAsync(attempt, cancellationToken);
}
