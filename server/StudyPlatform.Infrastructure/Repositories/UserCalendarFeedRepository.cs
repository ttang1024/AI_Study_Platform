using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class UserCalendarFeedRepository : Repository<UserCalendarFeed>, IUserCalendarFeedRepository
{
    public UserCalendarFeedRepository(AppDbContext context) : base(context) { }
}
