using Moq;
using StudyPlatform.Application.WorkedProblems.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.WorkedProblems;

public class GetWorkedProblemsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IWorkedProblemRepository> _problems = new();
    private readonly GetWorkedProblemsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetWorkedProblemsQueryHandlerTests()
    {
        _uow.Setup(u => u.WorkedProblems).Returns(_problems.Object);
        _handler = new GetWorkedProblemsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_MapsProblemsIncludingSteps()
    {
        var docId = Guid.NewGuid();
        _problems.Setup(r => r.GetByUserAsync(_userId, docId, null, default)).ReturnsAsync(new[]
        {
            new WorkedProblem
            {
                WorkedProblemId = Guid.NewGuid(), UserId = _userId, DocumentId = docId,
                ProblemText = "Solve for x", StepsJson = "[{\"StepNumber\":1,\"Description\":\"Isolate x\"}]",
                FinalAnswer = "x=2", Difficulty = "medium",
            },
        });

        var result = await _handler.Handle(new GetWorkedProblemsQuery(_userId, docId, null), default);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Data!);
        var step = Assert.Single(dto.Steps);
        Assert.Equal("Isolate x", step.Description);
    }

    [Fact]
    public async Task Handle_MalformedStepsJson_ReturnsEmptySteps()
    {
        _problems.Setup(r => r.GetByUserAsync(_userId, null, null, default)).ReturnsAsync(new[]
        {
            new WorkedProblem { WorkedProblemId = Guid.NewGuid(), UserId = _userId, ProblemText = "x", StepsJson = "{bad", FinalAnswer = "y" },
        });

        var result = await _handler.Handle(new GetWorkedProblemsQuery(_userId, null, null), default);

        Assert.Empty(result.Data!.Single().Steps);
    }
}
