using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Queries;

public record GetDataExportsQuery(Guid UserId) : IRequest<Result<IReadOnlyList<DataExportDto>>>;

public class GetDataExportsQueryHandler
    : IRequestHandler<GetDataExportsQuery, Result<IReadOnlyList<DataExportDto>>>
{
    private readonly IDataExportRequestRepository _dataExportRequests;

    public GetDataExportsQueryHandler(IDataExportRequestRepository dataExportRequests)
    {
        _dataExportRequests = dataExportRequests;
    }

    public async Task<Result<IReadOnlyList<DataExportDto>>> Handle(
        GetDataExportsQuery request, CancellationToken cancellationToken)
    {
        var exports = await _dataExportRequests.GetForUserAsync(request.UserId, cancellationToken);
        IReadOnlyList<DataExportDto> dtos = exports.Select(DataExportMapper.ToDto).ToList();
        return Result<IReadOnlyList<DataExportDto>>.Success(dtos);
    }
}
