using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth.Commands;

public record LogoutCommand(string RefreshToken) : IRequest<Result>;

public class LogoutCommandHandler : IRequestHandler<LogoutCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public LogoutCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result> Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        var token = await _unitOfWork.RefreshTokens.GetValidTokenAsync(request.RefreshToken, cancellationToken);
        if (token != null)
        {
            token.IsRevoked = true;
            _unitOfWork.RefreshTokens.Update(token);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return Result.Success("Logged out successfully.");
    }
}
