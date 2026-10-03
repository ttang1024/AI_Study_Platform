using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Share.Preview;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Share.Queries;

/// <summary>
/// Builds the social link-preview card for a share token.
/// </summary>
/// <param name="Origin">Public origin of the web app the share URL belongs to.</param>
public record GetSharePreviewQuery(string Token, string Origin) : IRequest<Result<SharePreview>>;

public class GetSharePreviewQueryHandler : IRequestHandler<GetSharePreviewQuery, Result<SharePreview>>
{
    public const string NotFoundCode = "share_not_found";
    public const string ExpiredCode = "share_expired";

    private readonly IUnitOfWork _unitOfWork;
    private readonly ISharePreviewFactory _previews;

    public GetSharePreviewQueryHandler(IUnitOfWork unitOfWork, ISharePreviewFactory previews)
    {
        _unitOfWork = unitOfWork;
        _previews = previews;
    }

    public async Task<Result<SharePreview>> Handle(GetSharePreviewQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return Result<SharePreview>.Failure("Share not found", NotFoundCode);

        var share = await _unitOfWork.ShareTokens.GetByTokenAsync(request.Token, cancellationToken);
        if (share == null)
            return Result<SharePreview>.Failure("Share not found", NotFoundCode);

        if (share.ExpiresAt.HasValue && share.ExpiresAt.Value < DateTime.UtcNow)
            return Result<SharePreview>.Failure("This share link has expired", ExpiredCode);

        return Result<SharePreview>.Success(_previews.Create(share, request.Origin));
    }
}
