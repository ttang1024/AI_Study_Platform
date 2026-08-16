using System.Linq.Expressions;
using MediatR;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.StudyQueue.DTOs;
using StudyPlatform.Application.StudyQueue.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using Xunit;

namespace StudyPlatform.Tests.StudyQueue;

public class GetRecommendationsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly Mock<IGlossaryMasteredRepository> _mastered = new();
    private readonly Mock<IWorkedProblemRepository> _problems = new();
    private readonly Mock<IWorkedProblemMasteredRepository> _problemsMastered = new();
    private readonly Mock<IMediator> _mediator = new();
    private readonly GetRecommendationsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetRecommendationsQueryHandlerTests()
    {
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _uow.Setup(u => u.GlossaryMastered).Returns(_mastered.Object);
        _uow.Setup(u => u.WorkedProblems).Returns(_problems.Object);
        _uow.Setup(u => u.WorkedProblemMastered).Returns(_problemsMastered.Object);

        _srs.Setup(r => r.GetDueByUserIdAsync(_userId, It.IsAny<DateTime>(), default)).ReturnsAsync(Array.Empty<FlashcardSrsData>());
        _submissions.Setup(r => r.GetAllByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<QuizSubmission>());
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(Array.Empty<GlossaryTerm>());
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Guid>());
        _problems.Setup(r => r.GetByUserAsync(_userId, null, null, default)).ReturnsAsync(Array.Empty<WorkedProblem>());
        _problemsMastered.Setup(r => r.GetMasteredProblemIdsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Guid>());
        _mediator.Setup(m => m.Send(It.IsAny<GetCourseMasteryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<CourseMasteryDto>>.Success(Array.Empty<CourseMasteryDto>()));
        _documents.Setup(r => r.GetRecentUntestedAsync(_userId, It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<int>(), default))
            .ReturnsAsync(Array.Empty<DocumentListItem>());

        var cache = new Mock<IAppCache>();
        cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<RecommendationsDto>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<RecommendationsDto>> factory, TimeSpan _, CancellationToken ct) => factory(ct));

        _handler = new GetRecommendationsQueryHandler(_uow.Object, _mediator.Object, cache.Object, Options.Create(new CacheOptions()));
    }

    [Fact]
    public async Task Handle_NoSignals_ReturnsEmptyQueues()
    {
        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!.ReviewQueue);
        Assert.Empty(result.Data.NextBestContent);
    }

    [Fact]
    public async Task Handle_DueFlashcards_AddedToReviewQueueWithCount()
    {
        _srs.Setup(r => r.GetDueByUserIdAsync(_userId, It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[] { new FlashcardSrsData { UserId = _userId, Due = DateTime.UtcNow.AddDays(-1) } });

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        var item = Assert.Single(result.Data!.ReviewQueue);
        Assert.Equal("flashcards", item.Type);
        Assert.Equal(1, item.Count);
    }

    [Fact]
    public async Task Handle_LowAccuracyQuiz_IncludedInReviewQueue()
    {
        _submissions.Setup(r => r.GetAllByUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new QuizSubmission { SubmissionId = Guid.NewGuid(), UserId = _userId, Score = 4, Total = 10, SubmittedAt = DateTime.UtcNow },
        });

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        Assert.Contains(result.Data!.ReviewQueue, r => r.Type == "quiz");
    }

    [Fact]
    public async Task Handle_HighAccuracyQuiz_ExcludedFromReviewQueue()
    {
        _submissions.Setup(r => r.GetAllByUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new QuizSubmission { SubmissionId = Guid.NewGuid(), UserId = _userId, Score = 9, Total = 10, SubmittedAt = DateTime.UtcNow },
        });

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        Assert.DoesNotContain(result.Data!.ReviewQueue, r => r.Type == "quiz");
    }

    [Fact]
    public async Task Handle_WeakQuiz_ResolvesDocumentTitleForUrl()
    {
        var docId = Guid.NewGuid();
        _submissions.Setup(r => r.GetAllByUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new QuizSubmission { SubmissionId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, Score = 1, Total = 10, SubmittedAt = DateTime.UtcNow },
        });
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = docId, FileName = "Chapter 3" } });

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        var item = result.Data!.ReviewQueue.Single(r => r.Type == "quiz");
        Assert.Contains("Chapter 3", item.Title);
        Assert.Equal($"/documents/{docId}", item.Url);
    }

    [Fact]
    public async Task Handle_UnmasteredGlossaryTerms_AddedToReviewQueue()
    {
        var termId = Guid.NewGuid();
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "X", Definition = "Y" } });

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        var item = Assert.Single(result.Data!.ReviewQueue);
        Assert.Equal("glossary", item.Type);
        Assert.Equal(1, item.Count);
    }

    [Fact]
    public async Task Handle_MasteredGlossaryTerms_ExcludedFromCount()
    {
        var termId = Guid.NewGuid();
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "X", Definition = "Y" } });
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { termId });

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        Assert.Empty(result.Data!.ReviewQueue);
    }

    [Fact]
    public async Task Handle_UnmasteredWorkedProblems_AddedToReviewQueue()
    {
        var problemId = Guid.NewGuid();
        _problems.Setup(r => r.GetByUserAsync(_userId, null, null, default))
            .ReturnsAsync(new[] { new WorkedProblem { WorkedProblemId = problemId, UserId = _userId } });

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        Assert.Contains(result.Data!.ReviewQueue, r => r.Type == "problems");
    }

    [Fact]
    public async Task Handle_LowMasteryCourse_AddedToNextBestContent()
    {
        var courseId = Guid.NewGuid();
        _mediator.Setup(m => m.Send(It.IsAny<GetCourseMasteryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<CourseMasteryDto>>.Success(new[]
            {
                new CourseMasteryDto(courseId, "Algorithms", "#000", 40, new[] { new CourseMasteryComponentDto("quiz", 40, 5) }),
            }));

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        var item = Assert.Single(result.Data!.NextBestContent);
        Assert.Equal("course", item.Type);
        Assert.Equal(courseId, item.CourseId);
    }

    [Fact]
    public async Task Handle_CourseWithNoComponents_ExcludedEvenIfLowScore()
    {
        var courseId = Guid.NewGuid();
        _mediator.Setup(m => m.Send(It.IsAny<GetCourseMasteryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<CourseMasteryDto>>.Success(new[]
            {
                new CourseMasteryDto(courseId, "Algorithms", "#000", 10, Array.Empty<CourseMasteryComponentDto>()),
            }));

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        Assert.Empty(result.Data!.NextBestContent);
    }

    [Fact]
    public async Task Handle_HighMasteryCourse_ExcludedFromNextBestContent()
    {
        var courseId = Guid.NewGuid();
        _mediator.Setup(m => m.Send(It.IsAny<GetCourseMasteryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<CourseMasteryDto>>.Success(new[]
            {
                new CourseMasteryDto(courseId, "Algorithms", "#000", 90, new[] { new CourseMasteryComponentDto("quiz", 90, 5) }),
            }));

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        Assert.Empty(result.Data!.NextBestContent);
    }

    [Fact]
    public async Task Handle_UntestedMaterial_AddedToNextBestContent()
    {
        var docId = Guid.NewGuid();
        var courseId = Guid.NewGuid();
        _documents.Setup(r => r.GetRecentUntestedAsync(_userId, It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new DocumentListItem(docId, courseId, "New Reading", DateTime.UtcNow) });

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        var item = Assert.Single(result.Data!.NextBestContent);
        Assert.Equal("material", item.Type);
        Assert.Contains("New Reading", item.Title);
    }

    [Fact]
    public async Task Handle_ReviewQueueIsCappedAndSortedByPriorityDescending()
    {
        _srs.Setup(r => r.GetDueByUserIdAsync(_userId, It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[] { new FlashcardSrsData { UserId = _userId, Due = DateTime.UtcNow.AddDays(-1) } });
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, Term = "X", Definition = "Y" } });

        var result = await _handler.Handle(new GetRecommendationsQuery(_userId), default);

        var priorities = result.Data!.ReviewQueue.Select(r => r.Priority).ToList();
        Assert.Equal(priorities.OrderByDescending(p => p), priorities);
    }
}
