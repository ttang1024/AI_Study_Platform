using MediatR;
using StudyPlatform.Application.Admin.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Commands;

public record AdminLoginCommand(string Email, string Password) : IRequest<Result<AdminTokenResponse>>;

public class AdminLoginCommandHandler : IRequestHandler<AdminLoginCommand, Result<AdminTokenResponse>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITokenService _tokenService;
    private readonly IPasswordHasher _passwordHasher;

    public AdminLoginCommandHandler(IUnitOfWork unitOfWork, ITokenService tokenService, IPasswordHasher passwordHasher)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
        _passwordHasher = passwordHasher;
    }

    public async Task<Result<AdminTokenResponse>> Handle(AdminLoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByEmailAsync(request.Email.ToLowerInvariant(), cancellationToken);

        // One answer for every failure. A distinct "correct password, but not an admin" reply turned this
        // endpoint into a password checker for every account on the platform.
        if (user == null || !_passwordHasher.Verify(request.Password, user.PasswordHash) || !user.IsAdmin || !user.IsActive)
            return Result<AdminTokenResponse>.Failure("Invalid credentials.", "INVALID_CREDENTIALS");

        var token = _tokenService.GenerateAccessToken(user);
        return Result<AdminTokenResponse>.Success(new AdminTokenResponse(token), "Login successful.");
    }
}
