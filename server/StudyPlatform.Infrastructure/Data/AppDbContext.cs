using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Data.Configurations;

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
    public DbSet<YouTubeVideo> YouTubeVideos => Set<YouTubeVideo>();
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
    public DbSet<YouTubeTranscriptEntry> YouTubeTranscriptEntries => Set<YouTubeTranscriptEntry>();
    public DbSet<StudySession> StudySessions => Set<StudySession>();
    public DbSet<MistakeEntry> MistakeEntries => Set<MistakeEntry>();
    public DbSet<ExamPlan> ExamPlans => Set<ExamPlan>();
    public DbSet<QuizBattle> QuizBattles => Set<QuizBattle>();
    public DbSet<QuizBattleEntry> QuizBattleEntries => Set<QuizBattleEntry>();
    public DbSet<GroupAssignment> GroupAssignments => Set<GroupAssignment>();
    public DbSet<GroupAssignmentCompletion> GroupAssignmentCompletions => Set<GroupAssignmentCompletion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
