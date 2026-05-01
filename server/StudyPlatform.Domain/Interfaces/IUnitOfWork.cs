namespace StudyPlatform.Domain.Interfaces;

public interface IUnitOfWork : IDisposable
{
    IUserRepository Users { get; }
    ICourseRepository Courses { get; }
    IDocumentRepository Documents { get; }
    IOtpRepository Otps { get; }
    IRefreshTokenRepository RefreshTokens { get; }
    IQuizRepository Quizzes { get; }
    IFlashcardRepository Flashcards { get; }
    INoteRepository Notes { get; }
    IChatMessageRepository ChatMessages { get; }
    IAnalyticsRepository Analytics { get; }
    IQuizSubmissionRepository QuizSubmissions { get; }
    IYouTubeVideoRepository YouTubeVideos { get; }
    IGlossaryTermRepository GlossaryTerms { get; }
    IFeedbackRepository Feedbacks { get; }
    IShareTokenRepository ShareTokens { get; }
    IGlossaryMasteredRepository GlossaryMastered { get; }
    IWorkedProblemRepository WorkedProblems { get; }
    IWorkedProblemAttemptRepository WorkedProblemAttempts { get; }
    IDocumentAnnotationRepository DocumentAnnotations { get; }
    IStudyGroupRepository StudyGroups { get; }
    IStudyGroupMemberRepository StudyGroupMembers { get; }
    IStudyGroupSharedCourseRepository StudyGroupSharedCourses { get; }
    IGroupChatMessageRepository GroupChatMessages { get; }
    IConceptLinkRepository ConceptLinks { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    Task BeginTransactionAsync(CancellationToken cancellationToken = default);
    Task CommitTransactionAsync(CancellationToken cancellationToken = default);
    Task RollbackTransactionAsync(CancellationToken cancellationToken = default);
}
