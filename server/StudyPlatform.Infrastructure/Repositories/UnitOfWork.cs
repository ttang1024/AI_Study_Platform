using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
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
    private IVideoRepository? _youTubeVideos;
    private IGlossaryTermRepository? _glossaryTerms;
    private IFeedbackRepository? _feedbacks;
    private IShareTokenRepository? _shareTokens;
    private IGlossaryMasteredRepository? _glossaryMastered;
    private IWorkedProblemRepository? _workedProblems;
    private IWorkedProblemAttemptRepository? _workedProblemAttempts;
    private IWorkedProblemMasteredRepository? _workedProblemMastered;
    private IDocumentAnnotationRepository? _documentAnnotations;
    private IStudyGroupRepository? _studyGroups;
    private IStudyGroupMemberRepository? _studyGroupMembers;
    private IStudyGroupSharedCourseRepository? _studyGroupSharedCourses;
    private IGroupChatMessageRepository? _groupChatMessages;
    private IConceptLinkRepository? _conceptLinks;
    private IFlashcardSrsDataRepository? _flashcardSrs;
    private IStudySessionRepository? _studySessions;
    private IMistakeEntryRepository? _mistakeEntries;
    private IExamPlanRepository? _examPlans;
    private IQuizBattleRepository? _quizBattles;
    private IGroupAssignmentRepository? _groupAssignments;
    private IFlashcardReviewLogRepository? _flashcardReviewLogs;
    private IStreakCoverDayRepository? _streakCoverDays;
    private IUserCalendarFeedRepository? _userCalendarFeeds;
    private ICourseAudioOverviewRepository? _courseAudioOverviews;
    private IGroupNoteRepository? _groupNotes;
    private IAiJobRepository? _aiJobs;
    private IAiUsageRepository? _aiUsage;
    private IOrganizationRepository? _organizations;
    private IOrganizationMemberRepository? _organizationMembers;
    private IClassroomRepository? _classrooms;
    private IClassroomEnrollmentRepository? _classroomEnrollments;
    private IClassroomCourseRepository? _classroomCourses;
    private ISubscriptionRepository? _subscriptions;
    private IRubricRepository? _rubrics;
    private IEssaySubmissionRepository? _essaySubmissions;

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
    public IVideoRepository Videos => _youTubeVideos ??= new VideoRepository(_context);
    public IGlossaryTermRepository GlossaryTerms => _glossaryTerms ??= new GlossaryTermRepository(_context);
    public IFeedbackRepository Feedbacks => _feedbacks ??= new FeedbackRepository(_context);
    public IShareTokenRepository ShareTokens => _shareTokens ??= new ShareTokenRepository(_context);
    public IGlossaryMasteredRepository GlossaryMastered => _glossaryMastered ??= new GlossaryMasteredRepository(_context);
    public IWorkedProblemRepository WorkedProblems => _workedProblems ??= new WorkedProblemRepository(_context);
    public IWorkedProblemAttemptRepository WorkedProblemAttempts => _workedProblemAttempts ??= new WorkedProblemAttemptRepository(_context);
    public IWorkedProblemMasteredRepository WorkedProblemMastered => _workedProblemMastered ??= new WorkedProblemMasteredRepository(_context);
    public IDocumentAnnotationRepository DocumentAnnotations => _documentAnnotations ??= new DocumentAnnotationRepository(_context);
    public IStudyGroupRepository StudyGroups => _studyGroups ??= new StudyGroupRepository(_context);
    public IStudyGroupMemberRepository StudyGroupMembers => _studyGroupMembers ??= new StudyGroupMemberRepository(_context);
    public IStudyGroupSharedCourseRepository StudyGroupSharedCourses => _studyGroupSharedCourses ??= new StudyGroupSharedCourseRepository(_context);
    public IGroupChatMessageRepository GroupChatMessages => _groupChatMessages ??= new GroupChatMessageRepository(_context);
    public IConceptLinkRepository ConceptLinks => _conceptLinks ??= new ConceptLinkRepository(_context);
    public IFlashcardSrsDataRepository FlashcardSrs => _flashcardSrs ??= new FlashcardSrsDataRepository(_context);
    public IStudySessionRepository StudySessions => _studySessions ??= new StudySessionRepository(_context);
    public IMistakeEntryRepository MistakeEntries => _mistakeEntries ??= new MistakeEntryRepository(_context);
    public IExamPlanRepository ExamPlans => _examPlans ??= new ExamPlanRepository(_context);
    public IQuizBattleRepository QuizBattles => _quizBattles ??= new QuizBattleRepository(_context);
    public IGroupAssignmentRepository GroupAssignments => _groupAssignments ??= new GroupAssignmentRepository(_context);
    public IFlashcardReviewLogRepository FlashcardReviewLogs => _flashcardReviewLogs ??= new FlashcardReviewLogRepository(_context);
    public IStreakCoverDayRepository StreakCoverDays => _streakCoverDays ??= new StreakCoverDayRepository(_context);
    public IUserCalendarFeedRepository UserCalendarFeeds => _userCalendarFeeds ??= new UserCalendarFeedRepository(_context);
    public ICourseAudioOverviewRepository CourseAudioOverviews => _courseAudioOverviews ??= new CourseAudioOverviewRepository(_context);
    public IGroupNoteRepository GroupNotes => _groupNotes ??= new GroupNoteRepository(_context);
    public IAiJobRepository AiJobs => _aiJobs ??= new AiJobRepository(_context);
    public IAiUsageRepository AiUsage => _aiUsage ??= new AiUsageRepository(_context);
    public IOrganizationRepository Organizations => _organizations ??= new OrganizationRepository(_context);
    public IOrganizationMemberRepository OrganizationMembers => _organizationMembers ??= new OrganizationMemberRepository(_context);
    public IClassroomRepository Classrooms => _classrooms ??= new ClassroomRepository(_context);
    public IClassroomEnrollmentRepository ClassroomEnrollments => _classroomEnrollments ??= new ClassroomEnrollmentRepository(_context);
    public IClassroomCourseRepository ClassroomCourses => _classroomCourses ??= new ClassroomCourseRepository(_context);
    public ISubscriptionRepository Subscriptions => _subscriptions ??= new SubscriptionRepository(_context);
    public IRubricRepository Rubrics => _rubrics ??= new RubricRepository(_context);
    public IEssaySubmissionRepository EssaySubmissions => _essaySubmissions ??= new EssaySubmissionRepository(_context);

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => await _context.SaveChangesAsync(cancellationToken);

    public void Dispose()
    {
        if (!_disposed)
        {
            _context.Dispose();
            _disposed = true;
        }
        GC.SuppressFinalize(this);
    }
}
