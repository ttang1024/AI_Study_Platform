using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Mistakes;

public record SetMistakeStatusCommand(Guid MistakeId, Guid UserId, string Status) : IRequest<Result<MistakeDto>>;
public record DeleteMistakeCommand(Guid MistakeId, Guid UserId) : IRequest<Result<bool>>;

/// <summary>
/// Generates AI practice variants that test the same concept as a missed question.
/// </summary>
public record GenerateMistakeVariantsCommand(Guid MistakeId, Guid UserId) : IRequest<Result<IReadOnlyList<VariantQuestionDto>>>;

public class SetMistakeStatusCommandHandler : IRequestHandler<SetMistakeStatusCommand, Result<MistakeDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public SetMistakeStatusCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<MistakeDto>> Handle(SetMistakeStatusCommand request, CancellationToken cancellationToken)
    {
        if (request.Status is not ("open" or "resolved"))
            return Result<MistakeDto>.Failure("Invalid status.", "INVALID_STATUS");

        var entry = await _unitOfWork.MistakeEntries.FirstOrDefaultAsync(
            m => m.MistakeEntryId == request.MistakeId && m.UserId == request.UserId, cancellationToken);
        if (entry == null)
            return Result<MistakeDto>.Failure("Mistake not found.", "MISTAKE_NOT_FOUND");

        entry.Status = request.Status;
        entry.ResolvedAt = request.Status == "resolved" ? DateTime.UtcNow : null;
        _unitOfWork.MistakeEntries.Update(entry);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<MistakeDto>.Success(GetMistakesQueryHandler.ToDto(entry), "Mistake updated.");
    }
}

public class DeleteMistakeCommandHandler : IRequestHandler<DeleteMistakeCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteMistakeCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteMistakeCommand request, CancellationToken cancellationToken)
    {
        var entry = await _unitOfWork.MistakeEntries.FirstOrDefaultAsync(
            m => m.MistakeEntryId == request.MistakeId && m.UserId == request.UserId, cancellationToken);
        if (entry == null)
            return Result<bool>.Failure("Mistake not found.", "MISTAKE_NOT_FOUND");

        _unitOfWork.MistakeEntries.Remove(entry);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true, "Mistake deleted.");
    }
}

public class GenerateMistakeVariantsCommandHandler : IRequestHandler<GenerateMistakeVariantsCommand, Result<IReadOnlyList<VariantQuestionDto>>>
{
    private const int MaxVariants = 3;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;

    public GenerateMistakeVariantsCommandHandler(IUnitOfWork unitOfWork, IAiService aiService)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
    }

    public async Task<Result<IReadOnlyList<VariantQuestionDto>>> Handle(GenerateMistakeVariantsCommand request, CancellationToken cancellationToken)
    {
        var entry = await _unitOfWork.MistakeEntries.FirstOrDefaultAsync(
            m => m.MistakeEntryId == request.MistakeId && m.UserId == request.UserId, cancellationToken);
        if (entry == null)
            return Result<IReadOnlyList<VariantQuestionDto>>.Failure("Mistake not found.", "MISTAKE_NOT_FOUND");

        var content =
            $"A student answered the following question incorrectly (they chose \"{entry.UserAnswer}\").\n" +
            $"Question: {entry.Question}\n" +
            $"Correct answer: {entry.CorrectAnswer}\n" +
            $"Explanation: {entry.Explanation}\n\n" +
            "Create new practice questions that test the SAME underlying concept from different angles, " +
            "so the student can verify they now understand it. Do not repeat the original question verbatim.";

        var json = await _aiService.GenerateQuizAsync(content, "medium", cancellationToken);

        List<VariantQuestionDto>? variants;
        try
        {
            variants = JsonSerializer.Deserialize<List<VariantQuestionDto>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException)
        {
            return Result<IReadOnlyList<VariantQuestionDto>>.Failure("AI returned an unexpected format. Try again.", "AI_PARSE_ERROR");
        }

        if (variants == null || variants.Count == 0)
            return Result<IReadOnlyList<VariantQuestionDto>>.Failure("No variants generated. Try again.", "AI_EMPTY");

        return Result<IReadOnlyList<VariantQuestionDto>>.Success(variants.Take(MaxVariants).ToList());
    }
}
