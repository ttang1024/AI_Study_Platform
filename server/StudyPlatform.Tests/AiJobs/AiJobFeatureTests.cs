using MediatR;
using Microsoft.Extensions.Logging;
using Moq;
using StudyPlatform.Application.AiJobs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.AiJobs;

public class RequestAiJobCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IAiJobRepository> _jobs = new();
    private readonly RequestAiJobCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public RequestAiJobCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.AiJobs).Returns(_jobs.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(new Document { DocumentId = _documentId, UserId = _userId });
        _jobs.Setup(r => r.GetActiveAsync(_userId, _documentId, It.IsAny<string>(), default)).ReturnsAsync((AiJob?)null);
        _jobs.Setup(r => r.AddAsync(It.IsAny<AiJob>(), default)).Returns(Task.CompletedTask);
        _handler = new RequestAiJobCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_UnsupportedJobType_ReturnsFailure()
    {
        var result = await _handler.Handle(new RequestAiJobCommand(_userId, _documentId, "summary", null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("UNSUPPORTED_JOB_TYPE", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DocumentNotOwned_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(new Document { DocumentId = _documentId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new RequestAiJobCommand(_userId, _documentId, AiJobType.Flashcards, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_JobAlreadyInFlight_ReturnsExistingJobWithoutCreatingANewOne()
    {
        var existing = new AiJob { AiJobId = Guid.NewGuid(), UserId = _userId, DocumentId = _documentId, JobType = AiJobType.Flashcards, Status = AiJobStatus.Running };
        _jobs.Setup(r => r.GetActiveAsync(_userId, _documentId, AiJobType.Flashcards, default)).ReturnsAsync(existing);

        var result = await _handler.Handle(new RequestAiJobCommand(_userId, _documentId, AiJobType.Flashcards, null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(existing.AiJobId, result.Data!.Id);
        _jobs.Verify(r => r.AddAsync(It.IsAny<AiJob>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_NoInFlightJob_QueuesNewJob()
    {
        var result = await _handler.Handle(new RequestAiJobCommand(_userId, _documentId, AiJobType.Quiz, "hard"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(AiJobStatus.Queued, result.Data!.Status);
        _jobs.Verify(r => r.AddAsync(It.IsAny<AiJob>(), default), Times.Once);
    }
}

public class GetAiJobQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IAiJobRepository> _jobs = new();
    private readonly GetAiJobQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _jobId = Guid.NewGuid();

    public GetAiJobQueryHandlerTests()
    {
        _uow.Setup(u => u.AiJobs).Returns(_jobs.Object);
        _handler = new GetAiJobQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_JobNotFound_ReturnsFailure()
    {
        _jobs.Setup(r => r.GetByIdAsync(_jobId, default)).ReturnsAsync((AiJob?)null);

        var result = await _handler.Handle(new GetAiJobQuery(_userId, _jobId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("JOB_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_JobOwnedByOtherUser_ReturnsFailure()
    {
        _jobs.Setup(r => r.GetByIdAsync(_jobId, default)).ReturnsAsync(new AiJob { AiJobId = _jobId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new GetAiJobQuery(_userId, _jobId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("JOB_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_OwnedJob_ReturnsDto()
    {
        _jobs.Setup(r => r.GetByIdAsync(_jobId, default)).ReturnsAsync(new AiJob { AiJobId = _jobId, UserId = _userId, Status = AiJobStatus.Succeeded });

        var result = await _handler.Handle(new GetAiJobQuery(_userId, _jobId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.IsTerminal);
    }
}

public class RunAiJobCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IAiJobRepository> _jobs = new();
    private readonly Mock<IMediator> _mediator = new();
    private readonly Mock<IInstanceIdentity> _instance = new();
    private readonly RunAiJobCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();
    private readonly Guid _jobId = Guid.NewGuid();

    public RunAiJobCommandHandlerTests()
    {
        _uow.Setup(u => u.AiJobs).Returns(_jobs.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _instance.Setup(i => i.Id).Returns("instance-1");
        _handler = new RunAiJobCommandHandler(_uow.Object, _mediator.Object, _instance.Object, Mock.Of<ILogger<RunAiJobCommandHandler>>());
    }

    private AiJob MakeJob(string jobType) => new()
    {
        AiJobId = _jobId,
        UserId = _userId,
        DocumentId = _documentId,
        JobType = jobType,
        Status = AiJobStatus.Queued,
    };

    [Fact]
    public async Task Handle_JobNotFound_ReturnsFailure()
    {
        _jobs.Setup(r => r.GetByIdAsync(_jobId, default)).ReturnsAsync((AiJob?)null);

        var result = await _handler.Handle(new RunAiJobCommand(_jobId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("JOB_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ClaimsJob_StampsInstanceAndMarksRunning()
    {
        var job = MakeJob(AiJobType.Flashcards);
        _jobs.Setup(r => r.GetByIdAsync(_jobId, default)).ReturnsAsync(job);
        _mediator.Setup(m => m.Send(It.IsAny<GenerateFlashcardsCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<FlashcardDto>>.Success(Array.Empty<FlashcardDto>()));

        await _handler.Handle(new RunAiJobCommand(_jobId), default);

        Assert.Equal("instance-1", job.OwnerInstanceId);
    }

    [Fact]
    public async Task Handle_FlashcardsJobSucceeds_MarksJobSucceeded()
    {
        var job = MakeJob(AiJobType.Flashcards);
        _jobs.Setup(r => r.GetByIdAsync(_jobId, default)).ReturnsAsync(job);
        _mediator.Setup(m => m.Send(It.IsAny<GenerateFlashcardsCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<FlashcardDto>>.Success(Array.Empty<FlashcardDto>()));

        var result = await _handler.Handle(new RunAiJobCommand(_jobId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(AiJobStatus.Succeeded, job.Status);
        Assert.Null(job.Error);
        Assert.NotNull(job.CompletedAt);
    }

    [Fact]
    public async Task Handle_QuizJobDefaultsDifficultyToMedium()
    {
        var job = MakeJob(AiJobType.Quiz);
        job.Difficulty = null;
        _jobs.Setup(r => r.GetByIdAsync(_jobId, default)).ReturnsAsync(job);
        GenerateQuizCommand? captured = null;
        _mediator.Setup(m => m.Send(It.IsAny<GenerateQuizCommand>(), It.IsAny<CancellationToken>()))
            .Callback<IRequest<Result<IEnumerable<QuizDto>>>, CancellationToken>((cmd, _) => captured = (GenerateQuizCommand)cmd)
            .ReturnsAsync(Result<IEnumerable<QuizDto>>.Success(Array.Empty<QuizDto>()));

        await _handler.Handle(new RunAiJobCommand(_jobId), default);

        Assert.Equal("medium", captured!.Difficulty);
    }

    [Fact]
    public async Task Handle_GlossaryJobFails_MarksJobFailedWithMessage()
    {
        var job = MakeJob(AiJobType.Glossary);
        _jobs.Setup(r => r.GetByIdAsync(_jobId, default)).ReturnsAsync(job);
        _mediator.Setup(m => m.Send(It.IsAny<GenerateGlossaryCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<GlossaryTermDto>>.Failure("AI provider error"));

        var result = await _handler.Handle(new RunAiJobCommand(_jobId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("GENERATION_FAILED", result.ErrorCode);
        Assert.Equal(AiJobStatus.Failed, job.Status);
        Assert.Equal("AI provider error", job.Error);
    }

    [Fact]
    public async Task Handle_UnsupportedJobType_MarksJobFailed()
    {
        var job = MakeJob("unsupported-type");
        _jobs.Setup(r => r.GetByIdAsync(_jobId, default)).ReturnsAsync(job);

        var result = await _handler.Handle(new RunAiJobCommand(_jobId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal(AiJobStatus.Failed, job.Status);
    }

    [Fact]
    public async Task Handle_MediatorThrows_CatchesAndMarksJobFailed()
    {
        var job = MakeJob(AiJobType.Flashcards);
        _jobs.Setup(r => r.GetByIdAsync(_jobId, default)).ReturnsAsync(job);
        _mediator.Setup(m => m.Send(It.IsAny<GenerateFlashcardsCommand>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("boom"));

        var result = await _handler.Handle(new RunAiJobCommand(_jobId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal(AiJobStatus.Failed, job.Status);
        Assert.Equal("boom", job.Error);
    }

    [Fact]
    public async Task Handle_ErrorMessageLongerThan2000Chars_IsTruncated()
    {
        var job = MakeJob(AiJobType.Flashcards);
        _jobs.Setup(r => r.GetByIdAsync(_jobId, default)).ReturnsAsync(job);
        var longMessage = new string('x', 3000);
        _mediator.Setup(m => m.Send(It.IsAny<GenerateFlashcardsCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<FlashcardDto>>.Failure(longMessage));

        await _handler.Handle(new RunAiJobCommand(_jobId), default);

        Assert.Equal(2000, job.Error!.Length);
    }
}
