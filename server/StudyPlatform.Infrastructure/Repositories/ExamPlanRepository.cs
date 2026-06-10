using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class ExamPlanRepository : Repository<ExamPlan>, IExamPlanRepository
{
    public ExamPlanRepository(AppDbContext context) : base(context) { }
}
