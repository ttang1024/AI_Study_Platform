using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.LibraryTags.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.LibraryTags.Commands;

/// <param name="SavedLibraryViewId">Null creates a new view; set updates one.</param>
public record SaveLibraryViewCommand(
    Guid UserId, Guid? SavedLibraryViewId, string Name, string? Icon, string FiltersJson, int? Position)
    : IRequest<Result<SavedLibraryViewDto>>;

public class SaveLibraryViewCommandHandler
    : IRequestHandler<SaveLibraryViewCommand, Result<SavedLibraryViewDto>>
{
    /// <summary>Enough for anyone organising a library; a cap keeps the sidebar and the table sane.</summary>
    private const int MaxViewsPerUser = 50;

    private readonly IUnitOfWork _unitOfWork;

    public SaveLibraryViewCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<SavedLibraryViewDto>> Handle(
        SaveLibraryViewCommand request, CancellationToken cancellationToken)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length == 0)
            return Result<SavedLibraryViewDto>.Failure("Name is required.", "NAME_REQUIRED");

        // Validated as JSON before storing. The column is opaque to the server but the client
        // parses it on every load, so accepting a malformed blob here would break the library list
        // later, at a point with no useful error to show.
        var filters = string.IsNullOrWhiteSpace(request.FiltersJson) ? "{}" : request.FiltersJson;
        try
        {
            using var parsed = JsonDocument.Parse(filters);
            if (parsed.RootElement.ValueKind != JsonValueKind.Object)
                return Result<SavedLibraryViewDto>.Failure("Filters must be a JSON object.", "INVALID_FILTERS");
        }
        catch (JsonException)
        {
            return Result<SavedLibraryViewDto>.Failure("Filters must be valid JSON.", "INVALID_FILTERS");
        }

        var now = DateTime.UtcNow;
        SavedLibraryView view;

        if (request.SavedLibraryViewId is { } id)
        {
            var existing = await _unitOfWork.SavedLibraryViews.GetByIdAsync(id, cancellationToken);
            if (existing == null || existing.UserId != request.UserId)
                return Result<SavedLibraryViewDto>.Failure("Not found.", "VIEW_NOT_FOUND");

            existing.Name = name;
            existing.Icon = request.Icon;
            existing.FiltersJson = filters;
            if (request.Position is { } position)
                existing.Position = position;
            existing.UpdatedAt = now;

            _unitOfWork.SavedLibraryViews.Update(existing);
            view = existing;
        }
        else
        {
            var current = await _unitOfWork.SavedLibraryViews.GetForUserAsync(request.UserId, cancellationToken);
            if (current.Count >= MaxViewsPerUser)
                return Result<SavedLibraryViewDto>.Failure(
                    $"You can save up to {MaxViewsPerUser} views.", "TOO_MANY_VIEWS");

            view = new SavedLibraryView
            {
                SavedLibraryViewId = Guid.NewGuid(),
                UserId = request.UserId,
                Name = name,
                Icon = request.Icon,
                FiltersJson = filters,
                // Appended rather than inserted, so saving a view never reorders the ones already there.
                Position = request.Position ?? (current.Count == 0 ? 0 : current.Max(v => v.Position) + 1),
                CreatedAt = now,
                UpdatedAt = now,
            };

            await _unitOfWork.SavedLibraryViews.AddAsync(view, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<SavedLibraryViewDto>.Success(
            new SavedLibraryViewDto(
                view.SavedLibraryViewId, view.Name, view.Icon, view.FiltersJson, view.Position, view.CreatedAt),
            "Saved.");
    }
}

public record DeleteLibraryViewCommand(Guid UserId, Guid SavedLibraryViewId) : IRequest<Result>;

public class DeleteLibraryViewCommandHandler : IRequestHandler<DeleteLibraryViewCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteLibraryViewCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result> Handle(DeleteLibraryViewCommand request, CancellationToken cancellationToken)
    {
        var view = await _unitOfWork.SavedLibraryViews.GetByIdAsync(request.SavedLibraryViewId, cancellationToken);
        if (view == null || view.UserId != request.UserId)
            return Result.Failure("Not found.", "VIEW_NOT_FOUND");

        _unitOfWork.SavedLibraryViews.Remove(view);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("View deleted.");
    }
}

public record GetLibraryViewsQuery(Guid UserId) : IRequest<Result<IReadOnlyList<SavedLibraryViewDto>>>;

public class GetLibraryViewsQueryHandler
    : IRequestHandler<GetLibraryViewsQuery, Result<IReadOnlyList<SavedLibraryViewDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetLibraryViewsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IReadOnlyList<SavedLibraryViewDto>>> Handle(
        GetLibraryViewsQuery request, CancellationToken cancellationToken)
    {
        var views = await _unitOfWork.SavedLibraryViews.GetForUserAsync(request.UserId, cancellationToken);

        IReadOnlyList<SavedLibraryViewDto> dtos = views
            .Select(v => new SavedLibraryViewDto(
                v.SavedLibraryViewId, v.Name, v.Icon, v.FiltersJson, v.Position, v.CreatedAt))
            .ToList();

        return Result<IReadOnlyList<SavedLibraryViewDto>>.Success(dtos);
    }
}
