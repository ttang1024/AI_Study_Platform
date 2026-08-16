using Moq;
using StudyPlatform.Application.Feedback.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Feedback;

public class SubmitFeedbackCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFeedbackRepository> _feedbacks = new();
    private readonly SubmitFeedbackCommandHandler _handler;

    public SubmitFeedbackCommandHandlerTests()
    {
        _uow.Setup(u => u.Feedbacks).Returns(_feedbacks.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new SubmitFeedbackCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_CreatesFeedbackWithNewStatus()
    {
        Domain.Entities.Feedback? captured = null;
        _feedbacks.Setup(r => r.AddAsync(It.IsAny<Domain.Entities.Feedback>(), default))
            .Callback<Domain.Entities.Feedback, CancellationToken>((f, _) => captured = f)
            .Returns(Task.CompletedTask);
        var userId = Guid.NewGuid();

        var result = await _handler.Handle(
            new SubmitFeedbackCommand("bug", "Broken button", "It doesn't click", 3, userId, "a@b.com"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("new", captured!.Status);
        Assert.Equal("bug", captured.Type);
        Assert.Equal("Broken button", captured.Subject);
        Assert.Equal(userId, captured.UserId);
        Assert.NotEqual(Guid.Empty, captured.Id);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_AnonymousFeedback_AllowsNullUserFields()
    {
        Domain.Entities.Feedback? captured = null;
        _feedbacks.Setup(r => r.AddAsync(It.IsAny<Domain.Entities.Feedback>(), default))
            .Callback<Domain.Entities.Feedback, CancellationToken>((f, _) => captured = f)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(
            new SubmitFeedbackCommand("general", "Idea", "message", null, null, null), default);

        Assert.True(result.IsSuccess);
        Assert.Null(captured!.UserId);
        Assert.Null(captured.Rating);
    }
}
