using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.LibraryTags.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.LibraryTags.Commands;

/// <param name="Assign">True to add the tag to the items, false to remove it.</param>
public record AssignLibraryTagCommand(
    Guid UserId, Guid LibraryTagId, IReadOnlyList<LibraryItemRef> Items, bool Assign)
    : IRequest<Result<BulkTagResultDto>>;

public class AssignLibraryTagCommandHandler
    : IRequestHandler<AssignLibraryTagCommand, Result<BulkTagResultDto>>
{
    /// <summary>
    /// A ceiling on one request. Bulk assign exists for a multi-select, not for an unbounded
    /// scripted call, and every item costs an ownership check.
    /// </summary>
    private const int MaxItemsPerRequest = 500;

    private readonly IUnitOfWork _unitOfWork;

    public AssignLibraryTagCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<BulkTagResultDto>> Handle(
        AssignLibraryTagCommand request, CancellationToken cancellationToken)
    {
        var tag = await _unitOfWork.LibraryTags.GetByIdAsync(request.LibraryTagId, cancellationToken);
        if (tag == null || tag.UserId != request.UserId)
            return Result<BulkTagResultDto>.Failure("Not found.", "TAG_NOT_FOUND");

        if (request.Items.Count == 0)
            return Result<BulkTagResultDto>.Failure("No items were given.", "NO_ITEMS");

        if (request.Items.Count > MaxItemsPerRequest)
            return Result<BulkTagResultDto>.Failure(
                $"Tag at most {MaxItemsPerRequest} items at a time.", "TOO_MANY_ITEMS");

        var requested = request.Items
            .Select(i => (ItemKind: i.ItemKind?.Trim().ToLowerInvariant() ?? string.Empty, i.ItemId))
            .Where(i => i.ItemKind is "document" or "video")
            .Distinct()
            .ToList();

        if (requested.Count == 0)
            return Result<BulkTagResultDto>.Failure(
                "Items must be documents or videos.", "INVALID_ITEM_KIND");

        // The ids arrive from the client, so ownership is verified here rather than assumed. Without
        // this, a caller could tag — and, through a collection's item list, enumerate — documents
        // belonging to somebody else.
        var owned = await ResolveOwnedAsync(request.UserId, requested, cancellationToken);
        if (owned.Count == 0)
            return Result<BulkTagResultDto>.Failure("None of those items are in your library.", "NO_OWNED_ITEMS");

        var changed = request.Assign
            ? await _unitOfWork.LibraryTags.AssignAsync(tag.LibraryTagId, owned, cancellationToken)
            : await _unitOfWork.LibraryTags.UnassignAsync(tag.LibraryTagId, owned, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var noun = tag.Kind == LibraryTagKinds.Collection ? "collection" : "tag";
        var message = request.Assign
            ? changed == 0
                ? $"Everything selected was already in that {noun}."
                : $"Added {changed} item{(changed == 1 ? "" : "s")} to \"{tag.Name}\"."
            : changed == 0
                ? $"Nothing selected was in that {noun}."
                : $"Removed {changed} item{(changed == 1 ? "" : "s")} from \"{tag.Name}\".";

        return Result<BulkTagResultDto>.Success(
            new BulkTagResultDto(changed, request.Items.Count), message);
    }

    /// <summary>
    /// Narrows the requested items to the ones this user actually owns, in two queries rather than
    /// one per item.
    /// </summary>
    private async Task<List<(string ItemKind, Guid ItemId)>> ResolveOwnedAsync(
        Guid userId,
        List<(string ItemKind, Guid ItemId)> requested,
        CancellationToken cancellationToken)
    {
        var result = new List<(string, Guid)>();

        var documentIds = requested.Where(i => i.ItemKind == "document").Select(i => i.ItemId).ToList();
        if (documentIds.Count > 0)
        {
            var found = await _unitOfWork.Documents.FindAsNoTrackingAsync(
                d => d.UserId == userId && documentIds.Contains(d.DocumentId), cancellationToken);
            result.AddRange(found.Select(d => ("document", d.DocumentId)));
        }

        var videoIds = requested.Where(i => i.ItemKind == "video").Select(i => i.ItemId).ToList();
        if (videoIds.Count > 0)
        {
            var found = await _unitOfWork.Videos.FindAsNoTrackingAsync(
                v => v.UserId == userId && videoIds.Contains(v.VideoId), cancellationToken);
            result.AddRange(found.Select(v => ("video", v.VideoId)));
        }

        return result;
    }
}
