using Microsoft.EntityFrameworkCore.Storage;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    private IDbContextTransaction? _transaction;
    private bool _disposed;

    private IUserRepository? _users;
    private ICourseRepository? _courses;
    private IDocumentRepository? _documents;
    private IOtpRepository? _otps;
    private IRefreshTokenRepository? _refreshTokens;
    private IQuizRepository? _quizzes;
    private IFlashcardRepository? _flashcards;
    private INoteRepository? _notes;
    private IChatMessageRepository? _chatMessages;
    private IAnalyticsRepository? _analytics;
    private IQuizSubmissionRepository? _quizSubmissions;
    private IYouTubeVideoRepository? _youTubeVideos;
    private IGlossaryTermRepository? _glossaryTerms;
    private IFeedbackRepository? _feedbacks;
    private IShareTokenRepository? _shareTokens;
    private IGlossaryMasteredRepository? _glossaryMastered;
    private IWorkedProblemRepository? _workedProblems;
    private IWorkedProblemAttemptRepository? _workedProblemAttempts;
    private IDocumentAnnotationRepository? _documentAnnotations;
    private IStudyGroupRepository? _studyGroups;
    private IStudyGroupMemberRepository? _studyGroupMembers;
    private IStudyGroupSharedCourseRepository? _studyGroupSharedCourses;
    private IGroupChatMessageRepository? _groupChatMessages;
    private IConceptLinkRepository? _conceptLinks;
    private IFlashcardSrsDataRepository? _flashcardSrs;

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
    }

    public IUserRepository Users => _users ??= new UserRepository(_context);
    public ICourseRepository Courses => _courses ??= new CourseRepository(_context);
    public IDocumentRepository Documents => _documents ??= new DocumentRepository(_context);
    public IOtpRepository Otps => _otps ??= new OtpRepository(_context);
    public IRefreshTokenRepository RefreshTokens => _refreshTokens ??= new RefreshTokenRepository(_context);
    public IQuizRepository Quizzes => _quizzes ??= new QuizRepository(_context);
    public IFlashcardRepository Flashcards => _flashcards ??= new FlashcardRepository(_context);
    public INoteRepository Notes => _notes ??= new NoteRepository(_context);
    public IChatMessageRepository ChatMessages => _chatMessages ??= new ChatMessageRepository(_context);
    public IAnalyticsRepository Analytics => _analytics ??= new AnalyticsRepository(_context);
    public IQuizSubmissionRepository QuizSubmissions => _quizSubmissions ??= new QuizSubmissionRepository(_context);
    public IYouTubeVideoRepository YouTubeVideos => _youTubeVideos ??= new YouTubeVideoRepository(_context);
    public IGlossaryTermRepository GlossaryTerms => _glossaryTerms ??= new GlossaryTermRepository(_context);
    public IFeedbackRepository Feedbacks => _feedbacks ??= new FeedbackRepository(_context);
    public IShareTokenRepository ShareTokens => _shareTokens ??= new ShareTokenRepository(_context);
    public IGlossaryMasteredRepository GlossaryMastered => _glossaryMastered ??= new GlossaryMasteredRepository(_context);
    public IWorkedProblemRepository WorkedProblems => _workedProblems ??= new WorkedProblemRepository(_context);
    public IWorkedProblemAttemptRepository WorkedProblemAttempts => _workedProblemAttempts ??= new WorkedProblemAttemptRepository(_context);
    public IDocumentAnnotationRepository DocumentAnnotations => _documentAnnotations ??= new DocumentAnnotationRepository(_context);
    public IStudyGroupRepository StudyGroups => _studyGroups ??= new StudyGroupRepository(_context);
    public IStudyGroupMemberRepository StudyGroupMembers => _studyGroupMembers ??= new StudyGroupMemberRepository(_context);
    public IStudyGroupSharedCourseRepository StudyGroupSharedCourses => _studyGroupSharedCourses ??= new StudyGroupSharedCourseRepository(_context);
    public IGroupChatMessageRepository GroupChatMessages => _groupChatMessages ??= new GroupChatMessageRepository(_context);
    public IConceptLinkRepository ConceptLinks => _conceptLinks ??= new ConceptLinkRepository(_context);
    public IFlashcardSrsDataRepository FlashcardSrs => _flashcardSrs ??= new FlashcardSrsDataRepository(_context);

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => await _context.SaveChangesAsync(cancellationToken);

    public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
        => _transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

    public async Task CommitTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_transaction != null)
            await _transaction.CommitAsync(cancellationToken);
    }

    public async Task RollbackTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_transaction != null)
            await _transaction.RollbackAsync(cancellationToken);
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _transaction?.Dispose();
            _context.Dispose();
            _disposed = true;
        }
        GC.SuppressFinalize(this);
    }
}
