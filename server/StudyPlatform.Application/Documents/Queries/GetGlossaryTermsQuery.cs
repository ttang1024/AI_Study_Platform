using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Queries;

public record GetGlossaryTermsQuery(Guid DocumentId, Guid UserId) : IRequest<Result<IEnumerable<GlossaryTermDto>>>;

public class GetGlossaryTermsQueryHandler : IRequestHandler<GetGlossaryTermsQuery, Result<IEnumerable<GlossaryTermDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetGlossaryTermsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IEnumerable<GlossaryTermDto>>> Handle(GetGlossaryTermsQuery request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<IEnumerable<GlossaryTermDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var terms = await _unitOfWork.GlossaryTerms.GetByDocumentIdAsync(request.DocumentId, cancellationToken);
        var dtos = terms.Select(t => t.ToGlossaryTermDto());
        return Result<IEnumerable<GlossaryTermDto>>.Success(dtos);
    }
}
