using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<Flashcard> Flashcards => Set<Flashcard>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<ChatConversation> ChatConversations => Set<ChatConversation>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<QuizSubmission> QuizSubmissions => Set<QuizSubmission>();
    public DbSet<Video> Videos => Set<Video>();
    public DbSet<GlossaryTerm> GlossaryTerms => Set<GlossaryTerm>();
    public DbSet<Feedback> Feedbacks => Set<Feedback>();
    public DbSet<ShareToken> ShareTokens => Set<ShareToken>();
    public DbSet<GlossaryMastered> GlossaryMastered => Set<GlossaryMastered>();
    public DbSet<WorkedProblem> WorkedProblems => Set<WorkedProblem>();
    public DbSet<WorkedProblemAttempt> WorkedProblemAttempts => Set<WorkedProblemAttempt>();
    public DbSet<WorkedProblemMastered> WorkedProblemMastered => Set<WorkedProblemMastered>();
    public DbSet<DocumentAnnotation> DocumentAnnotations => Set<DocumentAnnotation>();
    public DbSet<StudyGroup> StudyGroups => Set<StudyGroup>();
    public DbSet<StudyGroupMember> StudyGroupMembers => Set<StudyGroupMember>();
    public DbSet<StudyGroupSharedCourse> StudyGroupSharedCourses => Set<StudyGroupSharedCourse>();
    public DbSet<GroupChatMessage> GroupChatMessages => Set<GroupChatMessage>();
    public DbSet<ConceptLink> ConceptLinks => Set<ConceptLink>();
    public DbSet<FlashcardSrsData> FlashcardSrs => Set<FlashcardSrsData>();
    public DbSet<CacheEntry> CacheEntries => Set<CacheEntry>();
    public DbSet<VideoTranscriptEntry> VideoTranscriptEntries => Set<VideoTranscriptEntry>();
    public DbSet<StudySession> StudySessions => Set<StudySession>();
    public DbSet<MistakeEntry> MistakeEntries => Set<MistakeEntry>();
    public DbSet<ExamPlan> ExamPlans => Set<ExamPlan>();
    public DbSet<QuizBattle> QuizBattles => Set<QuizBattle>();
    public DbSet<QuizBattleEntry> QuizBattleEntries => Set<QuizBattleEntry>();
    public DbSet<GroupAssignment> GroupAssignments => Set<GroupAssignment>();
    public DbSet<GroupAssignmentCompletion> GroupAssignmentCompletions => Set<GroupAssignmentCompletion>();
    public DbSet<UserPushSubscription> UserPushSubscriptions => Set<UserPushSubscription>();
    public DbSet<FlashcardReviewLog> FlashcardReviewLogs => Set<FlashcardReviewLog>();
    public DbSet<StreakCoverDay> StreakCoverDays => Set<StreakCoverDay>();
    public DbSet<UserCalendarFeed> UserCalendarFeeds => Set<UserCalendarFeed>();
    public DbSet<CourseAudioOverview> CourseAudioOverviews => Set<CourseAudioOverview>();
    public DbSet<GroupNote> GroupNotes => Set<GroupNote>();
    public DbSet<AiUsageLog> AiUsageLogs => Set<AiUsageLog>();
    public DbSet<ContentEmbedding> ContentEmbeddings => Set<ContentEmbedding>();
    public DbSet<AiJob> AiJobs => Set<AiJob>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // vector  — the embedding column and its HNSW index (semantic search).
        // pg_trgm — GIN trigram indexes for the ILIKE '%term%' searches. A leading wildcard makes a
        //           B-tree useless, so without this every keyword search is a sequential scan whose
        //           cost grows with the size of the user's library.
        modelBuilder.HasPostgresExtension("vector");
        modelBuilder.HasPostgresExtension("pg_trgm");

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
