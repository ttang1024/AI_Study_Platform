using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record GenerateGlossaryCommand(Guid DocumentId, Guid UserId) : IRequest<Result<IEnumerable<GlossaryTermDto>>>;

public class GenerateGlossaryCommandHandler : IRequestHandler<GenerateGlossaryCommand, Result<IEnumerable<GlossaryTermDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    private readonly IDocumentContentService _contentService;
    private readonly IDocumentTextProvider _textProvider;

    public GenerateGlossaryCommandHandler(
        IUnitOfWork unitOfWork,
        IAiService aiService,
        IDocumentContentService contentService,
        IDocumentTextProvider textProvider)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _contentService = contentService;
        _textProvider = textProvider;
    }

    public async Task<Result<IEnumerable<GlossaryTermDto>>> Handle(GenerateGlossaryCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<IEnumerable<GlossaryTermDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        try
        {
            // Delete existing terms so we can regenerate
            await _unitOfWork.GlossaryTerms.DeleteByDocumentIdAsync(request.DocumentId, cancellationToken);

            var (bytes, text) = await _contentService.GetContentAsync(document, cancellationToken);
            var glossaryJson = bytes != null
                ? await _aiService.GenerateGlossaryAsync(bytes, document.ContentType, cancellationToken)
                : await _aiService.GenerateGlossaryAsync(text!, cancellationToken);

            List<AiGlossaryItem> items;
            try
            {
                items = JsonSerializer.Deserialize<List<AiGlossaryItem>>(glossaryJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<AiGlossaryItem>();
            }
            catch (JsonException)
            {
                return Result<IEnumerable<GlossaryTermDto>>.Failure("AI returned an unexpected response format. Please try again.", "PARSE_ERROR");
            }

            // See GenerateFlashcardsCommand: anchored against the stored canonical text so PDFs, which
            // reach the model as bytes, are citable too.
            var anchorSource = await _textProvider.GetTextAsync(document, cancellationToken);

            var terms = items.Select(i =>
            {
                var anchor = SourceAnchorResolver.Resolve(anchorSource, i.Quote);
                return new GlossaryTerm
                {
                    GlossaryTermId = Guid.NewGuid(),
                    DocumentId = request.DocumentId,
                    UserId = request.UserId,
                    Term = i.Term,
                    Definition = i.Definition,
                    SourceAnchorJson = anchor == null ? null : SourceAnchorResolver.Serialize(anchor),
                    SourceVersion = document.ContentVersion,
                    CreatedAt = DateTime.UtcNow
                };
            }).ToList();

            await _unitOfWork.GlossaryTerms.AddRangeAsync(terms, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var dtos = terms.Select(t => t.ToGlossaryTermDto());
            return Result<IEnumerable<GlossaryTermDto>>.Success(dtos, "Glossary generated successfully.");
        }
        catch (Exception ex)
        {
            return Result<IEnumerable<GlossaryTermDto>>.Failure(
                $"Failed to generate glossary: {ex.Message}", "GENERATION_FAILED");
        }
    }

}
