using MediatR;
using Moq;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Certificates;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Certificates;

public class IssueCertificateCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<ICourseCertificateRepository> _certificates = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IMediator> _mediator = new();
    private readonly IssueCertificateCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public IssueCertificateCommandHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.CourseCertificates).Returns(_certificates.Object);
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId, CourseName = "Algorithms" });
        _certificates.Setup(r => r.GetForCourseAsync(_userId, _courseId, default)).ReturnsAsync((CourseCertificate?)null);
        _certificates.Setup(r => r.AddAsync(It.IsAny<CourseCertificate>(), default)).Returns(Task.CompletedTask);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(new User { UserId = _userId, FullName = "Ada Lovelace" });
        _handler = new IssueCertificateCommandHandler(_uow.Object, _mediator.Object);
    }

    private void SetupMastery(double score)
    {
        var dto = new CourseMasteryDto(_courseId, "Algorithms", "#000", score, Array.Empty<CourseMasteryComponentDto>());
        _mediator.Setup(m => m.Send(It.IsAny<GetCourseMasteryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<CourseMasteryDto>>.Success(new[] { dto }));
    }

    [Fact]
    public async Task Handle_CourseNotOwned_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync((Course?)null);

        var result = await _handler.Handle(new IssueCertificateCommand(_userId, _courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AlreadyIssued_ReturnsExistingWithoutCreatingANew()
    {
        var existing = new CourseCertificate { CourseCertificateId = Guid.NewGuid(), UserId = _userId, CourseId = _courseId, CourseName = "Algorithms" };
        _certificates.Setup(r => r.GetForCourseAsync(_userId, _courseId, default)).ReturnsAsync(existing);

        var result = await _handler.Handle(new IssueCertificateCommand(_userId, _courseId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(existing.CourseCertificateId, result.Data!.CourseCertificateId);
        _certificates.Verify(r => r.AddAsync(It.IsAny<CourseCertificate>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_NoMasteryData_ReturnsFailure()
    {
        _mediator.Setup(m => m.Send(It.IsAny<GetCourseMasteryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<CourseMasteryDto>>.Success(Array.Empty<CourseMasteryDto>()));

        var result = await _handler.Handle(new IssueCertificateCommand(_userId, _courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_MASTERY_DATA", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_BelowThreshold_ReturnsNotEligible()
    {
        SetupMastery(79.9);

        var result = await _handler.Handle(new IssueCertificateCommand(_userId, _courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_ELIGIBLE", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AtThreshold_IssuesCertificate()
    {
        SetupMastery(80.0);

        var result = await _handler.Handle(new IssueCertificateCommand(_userId, _courseId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Ada Lovelace", result.Data!.RecipientName);
        Assert.Equal(80.0, result.Data.MasteryScore);
    }

    [Fact]
    public async Task Handle_MasteryScoreRoundedToOneDecimal()
    {
        SetupMastery(87.849);

        var result = await _handler.Handle(new IssueCertificateCommand(_userId, _courseId), default);

        Assert.Equal(87.8, result.Data!.MasteryScore);
    }

    [Fact]
    public async Task Handle_GeneratesUrlSafeToken()
    {
        SetupMastery(90);

        var result = await _handler.Handle(new IssueCertificateCommand(_userId, _courseId), default);

        Assert.DoesNotContain("+", result.Data!.PublicToken);
        Assert.DoesNotContain("/", result.Data.PublicToken);
        Assert.DoesNotContain("=", result.Data.PublicToken);
    }

    [Fact]
    public async Task Handle_UserNotFound_ReturnsFailure()
    {
        SetupMastery(90);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new IssueCertificateCommand(_userId, _courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
    }
}

public class GetMyCertificatesQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseCertificateRepository> _certificates = new();
    private readonly GetMyCertificatesQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetMyCertificatesQueryHandlerTests()
    {
        _uow.Setup(u => u.CourseCertificates).Returns(_certificates.Object);
        _handler = new GetMyCertificatesQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_MapsCertificatesToDtos()
    {
        _certificates.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(new List<CourseCertificate>
        {
            new() { CourseCertificateId = Guid.NewGuid(), UserId = _userId, CourseName = "Algorithms", RecipientName = "Ada" },
        });

        var result = await _handler.Handle(new GetMyCertificatesQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
    }
}

public class VerifyCertificateQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseCertificateRepository> _certificates = new();
    private readonly VerifyCertificateQueryHandler _handler;

    public VerifyCertificateQueryHandlerTests()
    {
        _uow.Setup(u => u.CourseCertificates).Returns(_certificates.Object);
        _handler = new VerifyCertificateQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_TokenNotFound_ReturnsFailure()
    {
        _certificates.Setup(r => r.GetByTokenAsync("bad-token", default)).ReturnsAsync((CourseCertificate?)null);

        var result = await _handler.Handle(new VerifyCertificateQuery("bad-token"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("CERTIFICATE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidToken_ReturnsPublicDtoWithoutIdentifiers()
    {
        _certificates.Setup(r => r.GetByTokenAsync("tok-1", default))
            .ReturnsAsync(new CourseCertificate { PublicToken = "tok-1", CourseName = "Algorithms", RecipientName = "Ada", MasteryScore = 90 });

        var result = await _handler.Handle(new VerifyCertificateQuery("tok-1"), default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Data!.IsRevoked);
    }

    [Fact]
    public async Task Handle_RevokedCertificate_IsRevokedTrue()
    {
        _certificates.Setup(r => r.GetByTokenAsync("tok-1", default))
            .ReturnsAsync(new CourseCertificate { PublicToken = "tok-1", RevokedAt = DateTime.UtcNow });

        var result = await _handler.Handle(new VerifyCertificateQuery("tok-1"), default);

        Assert.True(result.Data!.IsRevoked);
    }
}

public class GetCertificateEligibilityQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseCertificateRepository> _certificates = new();
    private readonly Mock<IMediator> _mediator = new();
    private readonly GetCertificateEligibilityQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetCertificateEligibilityQueryHandlerTests()
    {
        _uow.Setup(u => u.CourseCertificates).Returns(_certificates.Object);
        _handler = new GetCertificateEligibilityQueryHandler(_uow.Object, _mediator.Object);
    }

    [Fact]
    public async Task Handle_MasteryQueryFails_ReturnsEmptyList()
    {
        _mediator.Setup(m => m.Send(It.IsAny<GetCourseMasteryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<CourseMasteryDto>>.Failure("error"));

        var result = await _handler.Handle(new GetCertificateEligibilityQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task Handle_MarksAlreadyIssuedCourses()
    {
        var courseId = Guid.NewGuid();
        var dto = new CourseMasteryDto(courseId, "Algorithms", "#000", 90, Array.Empty<CourseMasteryComponentDto>());
        _mediator.Setup(m => m.Send(It.IsAny<GetCourseMasteryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<CourseMasteryDto>>.Success(new[] { dto }));
        _certificates.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(new List<CourseCertificate>
        {
            new() { CourseId = courseId, RevokedAt = null },
        });

        var result = await _handler.Handle(new GetCertificateEligibilityQuery(_userId), default);

        Assert.True(result.Data!.Single().AlreadyIssued);
    }

    [Fact]
    public async Task Handle_RevokedCertificateDoesNotCountAsIssued()
    {
        var courseId = Guid.NewGuid();
        var dto = new CourseMasteryDto(courseId, "Algorithms", "#000", 90, Array.Empty<CourseMasteryComponentDto>());
        _mediator.Setup(m => m.Send(It.IsAny<GetCourseMasteryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<CourseMasteryDto>>.Success(new[] { dto }));
        _certificates.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(new List<CourseCertificate>
        {
            new() { CourseId = courseId, RevokedAt = DateTime.UtcNow },
        });

        var result = await _handler.Handle(new GetCertificateEligibilityQuery(_userId), default);

        Assert.False(result.Data!.Single().AlreadyIssued);
    }

    [Fact]
    public async Task Handle_IsEligibleReflectsThreshold()
    {
        var below = new CourseMasteryDto(Guid.NewGuid(), "Below", "#000", 79, Array.Empty<CourseMasteryComponentDto>());
        var above = new CourseMasteryDto(Guid.NewGuid(), "Above", "#000", 85, Array.Empty<CourseMasteryComponentDto>());
        _mediator.Setup(m => m.Send(It.IsAny<GetCourseMasteryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<CourseMasteryDto>>.Success(new[] { below, above }));
        _certificates.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(new List<CourseCertificate>());

        var result = await _handler.Handle(new GetCertificateEligibilityQuery(_userId), default);

        Assert.False(result.Data!.Single(d => d.CourseName == "Below").IsEligible);
        Assert.True(result.Data!.Single(d => d.CourseName == "Above").IsEligible);
    }

    [Fact]
    public async Task Handle_OrdersByMasteryScoreDescending()
    {
        var low = new CourseMasteryDto(Guid.NewGuid(), "Low", "#000", 60, Array.Empty<CourseMasteryComponentDto>());
        var high = new CourseMasteryDto(Guid.NewGuid(), "High", "#000", 95, Array.Empty<CourseMasteryComponentDto>());
        _mediator.Setup(m => m.Send(It.IsAny<GetCourseMasteryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IEnumerable<CourseMasteryDto>>.Success(new[] { low, high }));
        _certificates.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(new List<CourseCertificate>());

        var result = await _handler.Handle(new GetCertificateEligibilityQuery(_userId), default);

        Assert.Equal(new[] { "High", "Low" }, result.Data!.Select(d => d.CourseName));
    }
}

public class RevokeCertificateCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseCertificateRepository> _certificates = new();
    private readonly RevokeCertificateCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _certificateId = Guid.NewGuid();

    public RevokeCertificateCommandHandlerTests()
    {
        _uow.Setup(u => u.CourseCertificates).Returns(_certificates.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new RevokeCertificateCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        _certificates.Setup(r => r.GetByIdAsync(_certificateId, default))
            .ReturnsAsync(new CourseCertificate { CourseCertificateId = _certificateId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new RevokeCertificateCommand(_userId, _certificateId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("CERTIFICATE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AlreadyRevoked_ReturnsFailure()
    {
        _certificates.Setup(r => r.GetByIdAsync(_certificateId, default))
            .ReturnsAsync(new CourseCertificate { CourseCertificateId = _certificateId, UserId = _userId, RevokedAt = DateTime.UtcNow });

        var result = await _handler.Handle(new RevokeCertificateCommand(_userId, _certificateId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ALREADY_REVOKED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidRequest_SetsRevokedAt()
    {
        var certificate = new CourseCertificate { CourseCertificateId = _certificateId, UserId = _userId, RevokedAt = null };
        _certificates.Setup(r => r.GetByIdAsync(_certificateId, default)).ReturnsAsync(certificate);

        var result = await _handler.Handle(new RevokeCertificateCommand(_userId, _certificateId), default);

        Assert.True(result.IsSuccess);
        Assert.NotNull(certificate.RevokedAt);
        _certificates.Verify(r => r.Update(certificate), Times.Once);
    }
}
