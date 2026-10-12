using MediatR;
using StudyPlatform.Application.Admin.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Queries;

public record ListFeedbackQuery(
    int Page,
    int PageSize,
    string? Status,
    string? Type,
    string? Search,
    string? Sort) : IRequest<Result<PaginatedList<FeedbackItemDto>>>, IPagedRequest;

public class ListFeedbackQueryHandler : IRequestHandler<ListFeedbackQuery, Result<PaginatedList<FeedbackItemDto>>>
{
    private readonly IFeedbackRepository _feedbacks;

    public ListFeedbackQueryHandler(IFeedbackRepository feedbacks) => _feedbacks = feedbacks;

    public async Task<Result<PaginatedList<FeedbackItemDto>>> Handle(ListFeedbackQuery request, CancellationToken cancellationToken)
    {
        var (items, total) = await _feedbacks.ListAsync(
            request.Page, request.PageSize,
            request.Status, request.Type, request.Search, request.Sort,
            cancellationToken);

        var dtos = items.Select(f => f.ToDto()).ToList();
        return Result<PaginatedList<FeedbackItemDto>>.Success(new PaginatedList<FeedbackItemDto>(dtos, total, request.Page, request.PageSize));
    }
}
