using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class MistakeEntryRepository : Repository<MistakeEntry>, IMistakeEntryRepository
{
    public MistakeEntryRepository(AppDbContext context) : base(context) { }
}
