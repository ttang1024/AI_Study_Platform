using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Onboarding;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record OnboardingStepDto(string Key, string Title, string Description, bool Done, string? ActionPath);

public record OnboardingStateDto(
    bool Dismissed,
    bool Complete,
    bool HasDemoContent,
    int CompletedCount,
    int TotalCount,
    IEnumerable<OnboardingStepDto> Steps);

// ── Query ───────────────────────────────────────────────────────────────────

public record GetOnboardingStateQuery(Guid UserId) : IRequest<Result<OnboardingStateDto>>;

/// <summary>
/// Derives the getting-started checklist from the user's actual library.
///
/// Nothing about step completion is stored. A persisted "has uploaded a document" flag would keep
/// claiming so after they delete the document, and every write path that could create a document
/// would have to remember to set it. Counting rows is cheap and cannot drift.
/// </summary>
public class GetOnboardingStateQueryHandler
    : IRequestHandler<GetOnboardingStateQuery, Result<OnboardingStateDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetOnboardingStateQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<OnboardingStateDto>> Handle(
        GetOnboardingStateQuery request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            return Result<OnboardingStateDto>.Failure("User not found.", "NOT_FOUND");

        var hasCourse = await _unitOfWork.Courses.ExistsAsync(
            c => c.UserId == request.UserId, cancellationToken);

        var hasDocument = await _unitOfWork.Documents.ExistsAsync(
            d => d.UserId == request.UserId, cancellationToken);

        var hasFlashcards = await _unitOfWork.Flashcards.ExistsAsync(
            f => f.UserId == request.UserId, cancellationToken);

        var hasReviewed = await _unitOfWork.FlashcardReviewLogs.ExistsAsync(
            r => r.UserId == request.UserId, cancellationToken);

        var steps = new List<OnboardingStepDto>
        {
            new("course", "Create a course",
                "Courses group everything you study for one subject.",
                hasCourse, "/library"),

            new("upload", "Add your first material",
                "Upload a document, or paste a video, podcast or article link.",
                hasDocument, "/summarizer"),

            new("generate", "Generate study material",
                "Turn what you added into flashcards, a quiz or a summary.",
                hasFlashcards, "/library"),

            new("review", "Review your first card",
                "Spaced repetition schedules the next review for you.",
                hasReviewed, "/flashcards"),
        };

        var completed = steps.Count(s => s.Done);

        return Result<OnboardingStateDto>.Success(new OnboardingStateDto(
            Dismissed: user.OnboardingDismissedAt != null,
            Complete: completed == steps.Count,
            HasDemoContent: user.DemoContentSeededAt != null,
            CompletedCount: completed,
            TotalCount: steps.Count,
            Steps: steps));
    }
}

// ── Commands ────────────────────────────────────────────────────────────────

public record DismissOnboardingCommand(Guid UserId) : IRequest<Result<bool>>;

public class DismissOnboardingCommandHandler : IRequestHandler<DismissOnboardingCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    public DismissOnboardingCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<bool>> Handle(DismissOnboardingCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            return Result<bool>.Failure("User not found.", "NOT_FOUND");

        user.OnboardingDismissedAt = DateTime.UtcNow;
        _unitOfWork.Users.Update(user);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Checklist dismissed.");
    }
}

public record SeedDemoContentCommand(Guid UserId) : IRequest<Result<Guid>>;

/// <summary>
/// Creates a small worked example — one course, one document, a summary, flashcards, a quiz and a
/// glossary — entirely from static content.
///
/// The point is that it makes no AI call. A new user has not configured a provider key yet, so
/// anything that needed one would fail at exactly the moment we are trying to show them the product
/// working. It also means seeding costs them nothing and cannot hit their quota.
/// </summary>
public class SeedDemoContentCommandHandler : IRequestHandler<SeedDemoContentCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;
    public SeedDemoContentCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<Guid>> Handle(SeedDemoContentCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            return Result<Guid>.Failure("User not found.", "NOT_FOUND");

        if (user.DemoContentSeededAt != null)
            return Result<Guid>.Failure("The sample course has already been added.", "ALREADY_SEEDED");

        var now = DateTime.UtcNow;

        var course = new Course
        {
            CourseId = Guid.NewGuid(),
            UserId = request.UserId,
            CourseName = "Sample: How Memory Works",
            CourseColor = "#0d9488",
            CreatedAt = now,
            UpdatedAt = now,
        };
        await _unitOfWork.Courses.AddAsync(course, cancellationToken);

        var document = new Document
        {
            DocumentId = Guid.NewGuid(),
            CourseId = course.CourseId,
            UserId = request.UserId,
            FileName = "How Memory Works.md",
            // No blob: nothing was uploaded. The viewer falls back to the extracted text, which is
            // the sample body below, so the document reads correctly without a file behind it.
            BlobUrl = string.Empty,
            ContentType = "text/markdown",
            FileSize = DemoBody.Length,
            ExtractedText = DemoBody,
            Summary = DemoSummary,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await _unitOfWork.Documents.AddAsync(document, cancellationToken);

        await _unitOfWork.Flashcards.AddRangeAsync(
            DemoFlashcards(request.UserId, document.DocumentId, now), cancellationToken);

        await _unitOfWork.Quizzes.AddRangeAsync(
            DemoQuizzes(request.UserId, document.DocumentId, now), cancellationToken);

        await _unitOfWork.GlossaryTerms.AddRangeAsync(
            DemoGlossary(request.UserId, document.DocumentId, now), cancellationToken);

        user.DemoContentSeededAt = now;
        _unitOfWork.Users.Update(user);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(course.CourseId, "Sample course added.");
    }

    // ── Static sample content ────────────────────────────────────────────────

    private const string DemoBody =
        "Spaced repetition is a learning technique that schedules reviews at increasing intervals. "
        + "Rather than rereading material until it feels familiar, you recall it from memory just as "
        + "you are about to forget it.\n\n"
        + "The forgetting curve, described by Hermann Ebbinghaus, shows that memory of new material "
        + "decays rapidly at first and then more slowly. Each successful recall flattens the curve, "
        + "so the next review can be scheduled further out.\n\n"
        + "Active recall is the act of retrieving information from memory rather than recognising it. "
        + "It is markedly more effective than passive review, because the effort of retrieval is "
        + "itself what strengthens the memory.\n\n"
        + "Interleaving means mixing different topics within one study session. It feels harder than "
        + "studying one topic at a time, and that difficulty is the point: it forces you to choose an "
        + "approach rather than applying the same one repeatedly.";

    private const string DemoSummary =
        "This sample shows what the platform produces from a source.\n\n"
        + "## Key Concepts\n\n"
        + "**Spaced repetition** schedules reviews at widening intervals, timed to just before you "
        + "would forget. **Active recall** — retrieving rather than rereading — is what actually "
        + "strengthens memory, which is why flashcards work better than highlighting. "
        + "**Interleaving** mixes topics in one session; the added difficulty is what makes it effective.\n\n"
        + "## Key Takeaways\n\n"
        + "- Recall beats recognition: test yourself instead of rereading.\n"
        + "- Each successful review earns a longer interval before the next one.\n"
        + "- Study feeling easy is a poor signal that it is working.\n";

    /// <summary>
    /// Sample cards carry real source anchors so the "show source" affordance is populated from the
    /// first minute, rather than looking broken until the user generates something themselves.
    /// </summary>
    private static List<Flashcard> DemoFlashcards(Guid userId, Guid documentId, DateTime now)
    {
        var cards = new (string Front, string Back, string Quote)[]
        {
            ("What is spaced repetition?",
             "Scheduling reviews at increasing intervals, timed for just before you would forget.",
             "schedules reviews at increasing intervals"),

            ("Why is active recall more effective than rereading?",
             "The effort of retrieving from memory is itself what strengthens the memory.",
             "the effort of retrieval is itself what strengthens the memory"),

            ("What does the forgetting curve describe?",
             "That memory of new material decays quickly at first, then more slowly — and that each recall flattens it.",
             "decays rapidly at first and then more slowly"),

            ("What is interleaving?",
             "Mixing different topics within one study session, which forces you to choose an approach each time.",
             "mixing different topics within one study session"),
        };

        return cards.Select(c =>
        {
            var anchor = SourceAnchorResolver.Resolve(DemoBody, c.Quote);
            return new Flashcard
            {
                FlashcardId = Guid.NewGuid(),
                DocumentId = documentId,
                SourceType = "document",
                UserId = userId,
                Front = c.Front,
                Back = c.Back,
                CardType = "basic",
                SourceAnchorJson = anchor == null ? null : SourceAnchorResolver.Serialize(anchor),
                CreatedAt = now,
                UpdatedAt = now,
            };
        }).ToList();
    }

    private static List<Quiz> DemoQuizzes(Guid userId, Guid documentId, DateTime now) =>
        new()
        {
            new Quiz
            {
                QuizId = Guid.NewGuid(),
                DocumentId = documentId,
                SourceType = "document",
                UserId = userId,
                Question = "Why does interleaving feel harder than studying one topic at a time?",
                OptionsJson = System.Text.Json.JsonSerializer.Serialize(new[]
                {
                    "A. It requires more total study hours",
                    "B. It forces you to choose an approach rather than reuse one",
                    "C. It removes all repetition from study",
                    "D. It shortens the interval between reviews",
                }),
                CorrectAnswer = "B",
                Explanation =
                    "Blocked practice lets you apply the same method repeatedly. Interleaving makes you "
                    + "identify which approach a problem needs, which is the harder — and more useful — skill.",
                Difficulty = "medium",
                CreatedAt = now,
            },
            new Quiz
            {
                QuizId = Guid.NewGuid(),
                DocumentId = documentId,
                SourceType = "document",
                UserId = userId,
                Question = "What happens to the forgetting curve after each successful recall?",
                OptionsJson = System.Text.Json.JsonSerializer.Serialize(new[]
                {
                    "A. It steepens, so reviews must come sooner",
                    "B. It is unaffected by recall",
                    "C. It flattens, so the next review can be scheduled further out",
                    "D. It resets to the original curve",
                }),
                CorrectAnswer = "C",
                Explanation =
                    "Each retrieval slows the decay, which is exactly what lets a scheduler push the next "
                    + "review further into the future.",
                Difficulty = "medium",
                CreatedAt = now,
            },
        };

    private static List<GlossaryTerm> DemoGlossary(Guid userId, Guid documentId, DateTime now) =>
        new()
        {
            new GlossaryTerm
            {
                GlossaryTermId = Guid.NewGuid(),
                DocumentId = documentId,
                UserId = userId,
                Term = "Active recall",
                Definition = "Retrieving information from memory rather than recognising it on the page.",
                CreatedAt = now,
            },
            new GlossaryTerm
            {
                GlossaryTermId = Guid.NewGuid(),
                DocumentId = documentId,
                UserId = userId,
                Term = "Forgetting curve",
                Definition = "Ebbinghaus's description of how memory of new material decays over time.",
                CreatedAt = now,
            },
            new GlossaryTerm
            {
                GlossaryTermId = Guid.NewGuid(),
                DocumentId = documentId,
                UserId = userId,
                Term = "Interleaving",
                Definition = "Mixing several topics within a single study session.",
                CreatedAt = now,
            },
        };
}
