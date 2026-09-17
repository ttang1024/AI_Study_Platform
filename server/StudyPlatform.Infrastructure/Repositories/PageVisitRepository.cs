using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class PageVisitRepository : Repository<PageVisit>, IPageVisitRepository
{
    public PageVisitRepository(AppDbContext context) : base(context) { }
}
