using MediatR;
using StudyPlatform.Application.Admin.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Queries;

public record ListUsersQuery(
    int Page,
    int PageSize,
    string? Search,
    string? Status,
    string? Sort) : IRequest<Result<PaginatedList<UserDto>>>, IPagedRequest;

public class ListUsersQueryHandler : IRequestHandler<ListUsersQuery, Result<PaginatedList<UserDto>>>
{
    private readonly IUserRepository _users;

    public ListUsersQueryHandler(IUserRepository users) => _users = users;

    public async Task<Result<PaginatedList<UserDto>>> Handle(ListUsersQuery request, CancellationToken cancellationToken)
    {
        var (items, total) = await _users.ListAsync(
            request.Page, request.PageSize, request.Search, request.Status, request.Sort, cancellationToken);

        var dtos = items.Select(u => new UserDto(
            u.UserId, u.Email, u.FullName,
            u.IsEmailVerified, u.IsAdmin, u.IsActive, u.CreatedAt)).ToList();

        return Result<PaginatedList<UserDto>>.Success(
            new PaginatedList<UserDto>(dtos, total, request.Page, request.PageSize));
    }
}
