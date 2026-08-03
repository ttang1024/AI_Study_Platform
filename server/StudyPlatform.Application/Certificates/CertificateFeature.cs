using System.Security.Cryptography;
using MediatR;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Certificates;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record CertificateDto(
    Guid CourseCertificateId,
    Guid? CourseId,
    string CourseName,
    string RecipientName,
    double MasteryScore,
    string PublicToken,
    DateTime IssuedAt,
    DateTime? RevokedAt);

/// <summary>
/// What an anonymous verifier sees. Deliberately narrower than <see cref="CertificateDto"/>: no user
/// id, no course id, nothing that could be used to probe the platform for the holder's other data.
/// </summary>
public record PublicCertificateDto(
    string CourseName,
    string RecipientName,
    double MasteryScore,
    DateTime IssuedAt,
    bool IsRevoked);

/// <summary>Whether a course qualifies yet, and how far off it is if not.</summary>
public record CertificateEligibilityDto(
    Guid CourseId,
    string CourseName,
    double MasteryScore,
    double RequiredScore,
    bool IsEligible,
    bool AlreadyIssued);

// ── Issue ───────────────────────────────────────────────────────────────────

public record IssueCertificateCommand(Guid UserId, Guid CourseId) : IRequest<Result<CertificateDto>>;

public class IssueCertificateCommandHandler : IRequestHandler<IssueCertificateCommand, Result<CertificateDto>>
{
    /// <summary>
    /// The mastery score a course must reach. 80 rather than 100 because the score blends four
    /// signals — retention, glossary, quiz accuracy, worked problems — and a perfect blend is
    /// unreachable in practice for anyone who ever got a card wrong.
    /// </summary>
    public const double RequiredMasteryScore = 80d;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;

    public IssueCertificateCommandHandler(IUnitOfWork unitOfWork, IMediator mediator)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
    }

    public async Task<Result<CertificateDto>> Handle(
        IssueCertificateCommand request, CancellationToken cancellationToken)
    {
        var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId, cancellationToken);
        if (course == null || course.UserId != request.UserId)
            return Result<CertificateDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

        var existing = await _unitOfWork.CourseCertificates.GetForCourseAsync(
            request.UserId, request.CourseId, cancellationToken);

        // Returned rather than refused. Asking twice means the user wants the certificate in hand,
        // and the honest answer is the one they already earned — re-issuing would move its date.
        if (existing != null)
            return Result<CertificateDto>.Success(ToDto(existing), "You already hold this certificate.");

        var mastery = await GetMasteryAsync(request.UserId, request.CourseId, cancellationToken);
        if (mastery == null)
            return Result<CertificateDto>.Failure(
                "This course has no study activity to assess yet.", "NO_MASTERY_DATA");

        if (mastery.Value < RequiredMasteryScore)
            return Result<CertificateDto>.Failure(
                $"You need {RequiredMasteryScore:0}% mastery to earn this certificate. You're at {mastery.Value:0}%.",
                "NOT_ELIGIBLE");

        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            return Result<CertificateDto>.Failure("User not found.", "USER_NOT_FOUND");

        var certificate = new CourseCertificate
        {
            CourseCertificateId = Guid.NewGuid(),
            UserId = request.UserId,
            CourseId = request.CourseId,
            CourseName = course.CourseName,
            RecipientName = user.FullName,
            MasteryScore = Math.Round(mastery.Value, 1),
            PublicToken = GenerateToken(),
            IssuedAt = DateTime.UtcNow,
        };

        await _unitOfWork.CourseCertificates.AddAsync(certificate, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<CertificateDto>.Success(ToDto(certificate), "Certificate issued.");
    }

    private async Task<double?> GetMasteryAsync(Guid userId, Guid courseId, CancellationToken cancellationToken)
    {
        // Reuses the dashboard's mastery calculation rather than recomputing it. Two definitions of
        // "mastered" would eventually disagree, and the one on the certificate is the one that has
        // to match what the user was looking at when they clicked.
        var result = await _mediator.Send(new GetCourseMasteryQuery(userId), cancellationToken);
        if (!result.IsSuccess || result.Data == null)
            return null;

        var course = result.Data.FirstOrDefault(c => c.CourseId == courseId);
        return course?.MasteryScore;
    }

    /// <summary>
    /// 256 bits, URL-safe. The token is the entire access control on the public page, so it is sized
    /// to be unguessable rather than to be short.
    /// </summary>
    internal static string GenerateToken()
        => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');

    internal static CertificateDto ToDto(CourseCertificate c) => new(
        c.CourseCertificateId, c.CourseId, c.CourseName, c.RecipientName,
        c.MasteryScore, c.PublicToken, c.IssuedAt, c.RevokedAt);
}

// ── Read ────────────────────────────────────────────────────────────────────

public record GetMyCertificatesQuery(Guid UserId) : IRequest<Result<IReadOnlyList<CertificateDto>>>;

public class GetMyCertificatesQueryHandler
    : IRequestHandler<GetMyCertificatesQuery, Result<IReadOnlyList<CertificateDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetMyCertificatesQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<IReadOnlyList<CertificateDto>>> Handle(
        GetMyCertificatesQuery request, CancellationToken cancellationToken)
    {
        var certificates = await _unitOfWork.CourseCertificates.GetForUserAsync(request.UserId, cancellationToken);
        IReadOnlyList<CertificateDto> dtos = certificates.Select(IssueCertificateCommandHandler.ToDto).ToList();
        return Result<IReadOnlyList<CertificateDto>>.Success(dtos);
    }
}

/// <summary>Anonymous lookup behind the shareable link.</summary>
public record VerifyCertificateQuery(string Token) : IRequest<Result<PublicCertificateDto>>;

public class VerifyCertificateQueryHandler
    : IRequestHandler<VerifyCertificateQuery, Result<PublicCertificateDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public VerifyCertificateQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<PublicCertificateDto>> Handle(
        VerifyCertificateQuery request, CancellationToken cancellationToken)
    {
        var certificate = await _unitOfWork.CourseCertificates.GetByTokenAsync(request.Token, cancellationToken);
        if (certificate == null)
            return Result<PublicCertificateDto>.Failure("No certificate matches that link.", "CERTIFICATE_NOT_FOUND");

        return Result<PublicCertificateDto>.Success(new PublicCertificateDto(
            certificate.CourseName,
            certificate.RecipientName,
            certificate.MasteryScore,
            certificate.IssuedAt,
            certificate.RevokedAt != null));
    }
}

/// <summary>Which of the user's courses are close to, or past, the certificate threshold.</summary>
public record GetCertificateEligibilityQuery(Guid UserId)
    : IRequest<Result<IReadOnlyList<CertificateEligibilityDto>>>;

public class GetCertificateEligibilityQueryHandler
    : IRequestHandler<GetCertificateEligibilityQuery, Result<IReadOnlyList<CertificateEligibilityDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;

    public GetCertificateEligibilityQueryHandler(IUnitOfWork unitOfWork, IMediator mediator)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
    }

    public async Task<Result<IReadOnlyList<CertificateEligibilityDto>>> Handle(
        GetCertificateEligibilityQuery request, CancellationToken cancellationToken)
    {
        var mastery = await _mediator.Send(new GetCourseMasteryQuery(request.UserId), cancellationToken);
        if (!mastery.IsSuccess || mastery.Data == null)
            return Result<IReadOnlyList<CertificateEligibilityDto>>.Success(Array.Empty<CertificateEligibilityDto>());

        var issued = (await _unitOfWork.CourseCertificates.GetForUserAsync(request.UserId, cancellationToken))
            .Where(c => c.RevokedAt == null && c.CourseId != null)
            .Select(c => c.CourseId!.Value)
            .ToHashSet();

        IReadOnlyList<CertificateEligibilityDto> dtos = mastery.Data
            .Select(m => new CertificateEligibilityDto(
                m.CourseId,
                m.CourseName,
                Math.Round(m.MasteryScore, 1),
                IssueCertificateCommandHandler.RequiredMasteryScore,
                m.MasteryScore >= IssueCertificateCommandHandler.RequiredMasteryScore,
                issued.Contains(m.CourseId)))
            .OrderByDescending(d => d.MasteryScore)
            .ToList();

        return Result<IReadOnlyList<CertificateEligibilityDto>>.Success(dtos);
    }
}

// ── Revoke ──────────────────────────────────────────────────────────────────

public record RevokeCertificateCommand(Guid UserId, Guid CourseCertificateId) : IRequest<Result>;

public class RevokeCertificateCommandHandler : IRequestHandler<RevokeCertificateCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public RevokeCertificateCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result> Handle(RevokeCertificateCommand request, CancellationToken cancellationToken)
    {
        var certificate = await _unitOfWork.CourseCertificates.GetByIdAsync(
            request.CourseCertificateId, cancellationToken);

        if (certificate == null || certificate.UserId != request.UserId)
            return Result.Failure("Certificate not found.", "CERTIFICATE_NOT_FOUND");

        if (certificate.RevokedAt != null)
            return Result.Failure("That certificate is already revoked.", "ALREADY_REVOKED");

        // Marked, not deleted, so a link already out in the world resolves to "revoked" rather than
        // to nothing — which is what someone checking it needs to be told.
        certificate.RevokedAt = DateTime.UtcNow;
        _unitOfWork.CourseCertificates.Update(certificate);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("Certificate revoked. Its share link now shows as withdrawn.");
    }
}
