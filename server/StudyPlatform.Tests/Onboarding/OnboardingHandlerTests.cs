using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Onboarding;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Onboarding;

public class GetOnboardingStateQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IFlashcardReviewLogRepository> _reviewLogs = new();

    private readonly Guid _userId = Guid.NewGuid();
    private readonly GetOnboardingStateQueryHandler _handler;

    public GetOnboardingStateQueryHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.FlashcardReviewLogs).Returns(_reviewLogs.Object);

        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(new User { UserId = _userId });

        _handler = new GetOnboardingStateQueryHandler(_uow.Object);
    }

    private void Has(bool course = false, bool document = false, bool flashcards = false, bool reviewed = false)
    {
        _courses.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<Course, bool>>>(), default)).ReturnsAsync(course);
        _documents.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(document);
        _flashcards.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<Flashcard, bool>>>(), default)).ReturnsAsync(flashcards);
        _reviewLogs.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<FlashcardReviewLog, bool>>>(), default)).ReturnsAsync(reviewed);
    }

    [Fact]
    public async Task NewAccount_HasNothingDone()
    {
        Has();

        var result = await _handler.Handle(new GetOnboardingStateQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Data!.CompletedCount);
        Assert.Equal(4, result.Data.TotalCount);
        Assert.False(result.Data.Complete);
        Assert.All(result.Data.Steps, s => Assert.False(s.Done));
    }

    [Fact]
    public async Task StepsReflectTheLibrary_NotStoredFlags()
    {
        // The point of deriving: deleting the document that earned a tick must untick it.
        Has(course: true, document: true);

        var result = await _handler.Handle(new GetOnboardingStateQuery(_userId), default);

        Assert.Equal(2, result.Data!.CompletedCount);
        Assert.True(result.Data.Steps.First(s => s.Key == "upload").Done);
        Assert.False(result.Data.Steps.First(s => s.Key == "generate").Done);
    }

    [Fact]
    public async Task AllStepsDone_IsComplete()
    {
        Has(course: true, document: true, flashcards: true, reviewed: true);

        var result = await _handler.Handle(new GetOnboardingStateQuery(_userId), default);

        Assert.True(result.Data!.Complete);
        Assert.Equal(4, result.Data.CompletedCount);
    }

    [Fact]
    public async Task DismissedFlagIsReported()
    {
        Has();
        _users.Setup(r => r.GetByIdAsync(_userId, default))
            .ReturnsAsync(new User { UserId = _userId, OnboardingDismissedAt = DateTime.UtcNow });

        var result = await _handler.Handle(new GetOnboardingStateQuery(_userId), default);

        Assert.True(result.Data!.Dismissed);
    }

    [Fact]
    public async Task UnknownUser_IsNotFound()
    {
        Has();
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new GetOnboardingStateQuery(_userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }
}

public class SeedDemoContentCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IGlossaryTermRepository> _glossary = new();

    private readonly Guid _userId = Guid.NewGuid();
    private readonly SeedDemoContentCommandHandler _handler;

    private readonly List<Flashcard> _addedCards = new();
    private Document? _addedDocument;

    public SeedDemoContentCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_glossary.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(new User { UserId = _userId });

        _courses.Setup(r => r.AddAsync(It.IsAny<Course>(), default)).Returns(Task.CompletedTask);
        _documents.Setup(r => r.AddAsync(It.IsAny<Document>(), default))
            .Callback<Document, CancellationToken>((d, _) => _addedDocument = d)
            .Returns(Task.CompletedTask);
        _flashcards.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default))
            .Callback<IEnumerable<Flashcard>, CancellationToken>((c, _) => _addedCards.AddRange(c))
            .Returns(Task.CompletedTask);
        _quizzes.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Quiz>>(), default)).Returns(Task.CompletedTask);
        _glossary.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<GlossaryTerm>>(), default)).Returns(Task.CompletedTask);

        _handler = new SeedDemoContentCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task SeedsACompleteWorkedExample()
    {
        var result = await _handler.Handle(new SeedDemoContentCommand(_userId), default);

        Assert.True(result.IsSuccess);
        _courses.Verify(r => r.AddAsync(It.IsAny<Course>(), default), Times.Once);
        _documents.Verify(r => r.AddAsync(It.IsAny<Document>(), default), Times.Once);
        _flashcards.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default), Times.Once);
        _quizzes.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<Quiz>>(), default), Times.Once);
        _glossary.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<GlossaryTerm>>(), default), Times.Once);
    }

    [Fact]
    public async Task SampleDocumentCarriesItsTextSoItReadsWithoutAFile()
    {
        // The sample uploads nothing, so BlobUrl is empty; the stored text is what makes the
        // document open correctly rather than 404 against missing blob storage.
        await _handler.Handle(new SeedDemoContentCommand(_userId), default);

        Assert.NotNull(_addedDocument);
        Assert.False(string.IsNullOrWhiteSpace(_addedDocument!.ExtractedText));
        Assert.False(string.IsNullOrWhiteSpace(_addedDocument.Summary));
    }

    [Fact]
    public async Task SampleCardsCarryResolvedSourceAnchors()
    {
        // Every sample quote is a verbatim slice of the sample body, so the citation affordance is
        // populated from the first minute. If a quote is ever edited out of sync with the body, the
        // resolver returns null and this fails — which is the point.
        await _handler.Handle(new SeedDemoContentCommand(_userId), default);

        Assert.NotEmpty(_addedCards);
        Assert.All(_addedCards, c => Assert.False(string.IsNullOrEmpty(c.SourceAnchorJson)));
    }

    [Fact]
    public async Task SecondSeed_IsRefused()
    {
        _users.Setup(r => r.GetByIdAsync(_userId, default))
            .ReturnsAsync(new User { UserId = _userId, DemoContentSeededAt = DateTime.UtcNow.AddDays(-1) });

        var result = await _handler.Handle(new SeedDemoContentCommand(_userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ALREADY_SEEDED", result.ErrorCode);
        _courses.Verify(r => r.AddAsync(It.IsAny<Course>(), default), Times.Never);
    }
}
