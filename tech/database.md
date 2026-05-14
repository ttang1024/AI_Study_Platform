# Database

## Provider

The active database provider is PostgreSQL through `Npgsql.EntityFrameworkCore.PostgreSQL`. `InfrastructureServiceExtensions.AddInfrastructure()` reads `ConnectionStrings:DefaultConnection` and enables EF retry-on-failure with 5 retries and a 30 second max delay.

`Program.cs` applies migrations at API startup with `db.Database.Migrate()`.

```csharp
// InfrastructureServiceExtensions.cs — EF Core + Npgsql registration
services.AddDbContext<AppDbContext>(options =>
{
    var connectionString = configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("Database connection string 'DefaultConnection' is not configured.");
    options.UseNpgsql(connectionString, npgsqlOptions =>
    {
        npgsqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(30),
            errorCodesToAdd: null);
    });
});

// Program.cs — auto-migrate on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}
```

## DbContext

`server/StudyPlatform.Infrastructure/Data/AppDbContext.cs` exposes sets for:

- users, refresh tokens, OTP codes
- courses, documents, YouTube videos, notes
- quizzes, quiz submissions, quiz attempts
- flashcards and FSRS state
- glossary terms and mastered glossary rows
- concept links
- chat conversations and chat messages
- feedback
- study groups, members, shared courses, group chat messages
- annotations
- worked problems, attempts, and mastered rows
- share tokens
- persistent cache entries (`CacheEntries`)
- YouTube transcript entries (`YouTubeTranscriptEntries`)

Configurations live in `server/StudyPlatform.Infrastructure/Data/Configurations`.

```csharp
// AppDbContext.cs — DbSet registration (excerpt)
public DbSet<User> Users => Set<User>();
public DbSet<Course> Courses => Set<Course>();
public DbSet<Document> Documents => Set<Document>();
public DbSet<YouTubeVideo> YouTubeVideos => Set<YouTubeVideo>();
public DbSet<Quiz> Quizzes => Set<Quiz>();
public DbSet<QuizSubmission> QuizSubmissions => Set<QuizSubmission>();
public DbSet<Flashcard> Flashcards => Set<Flashcard>();
public DbSet<FlashcardSrsData> FlashcardSrs => Set<FlashcardSrsData>();
public DbSet<Note> Notes => Set<Note>();
public DbSet<ChatConversation> ChatConversations => Set<ChatConversation>();
public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
public DbSet<GlossaryTerm> GlossaryTerms => Set<GlossaryTerm>();
public DbSet<WorkedProblem> WorkedProblems => Set<WorkedProblem>();
public DbSet<ConceptLink> ConceptLinks => Set<ConceptLink>();
public DbSet<CacheEntry> CacheEntries => Set<CacheEntry>();
public DbSet<YouTubeTranscriptEntry> YouTubeTranscriptEntries => Set<YouTubeTranscriptEntry>();
// ... and more (see AppDbContext.cs for the full list)

protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    base.OnModelCreating(modelBuilder);
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
}
```

Entity-level configuration is applied via `IEntityTypeConfiguration<T>` classes. Example for `RefreshToken`:

```csharp
// RefreshTokenConfiguration.cs
public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.HasKey(r => r.TokenId);
        builder.Property(r => r.Token).IsRequired().HasMaxLength(500);
        builder.Property(r => r.IsRevoked).HasDefaultValue(false);
        builder.HasIndex(r => r.Token).IsUnique();
        builder.HasIndex(r => new { r.UserId, r.IsRevoked, r.ExpiresAt });

        builder.HasOne(r => r.User)
            .WithMany(u => u.RefreshTokens)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

Example for `CacheEntry` (the PostgreSQL persistent-cache table):

```csharp
// CacheEntryConfiguration.cs
public class CacheEntryConfiguration : IEntityTypeConfiguration<CacheEntry>
{
    public void Configure(EntityTypeBuilder<CacheEntry> builder)
    {
        builder.HasKey(e => e.Key);
        builder.Property(e => e.Key).HasMaxLength(512);
        builder.Property(e => e.Value).IsRequired();
        builder.Property(e => e.ExpiresAt).IsRequired();
        builder.HasIndex(e => e.ExpiresAt);  // for TTL cleanup scans
    }
}
```

## Source Types

Several generated-study tables support both documents and videos:

| Entity | Source fields |
| --- | --- |
| `Flashcard` | `DocumentId?`, `YouTubeVideoId?`, `SourceType` |
| `Quiz` | `DocumentId?`, `YouTubeVideoId?`, `SourceType` |
| `GlossaryTerm` | document/video source fields |
| `WorkedProblem` | `DocumentId?`, `YouTubeVideoId?` |
| `ChatMessage` | document, video, or general conversation source |

## Unit of Work

All application-layer handlers go through `IUnitOfWork`, which lazily instantiates repositories and wraps `AppDbContext.SaveChangesAsync`. This keeps handlers decoupled from EF directly while sharing a single `DbContext` per request.

```csharp
// UnitOfWork.cs — lazy repository accessors + transaction support
public IFlashcardRepository Flashcards
    => _flashcards ??= new FlashcardRepository(_context);

public IFlashcardSrsDataRepository FlashcardSrs
    => _flashcardSrs ??= new FlashcardSrsDataRepository(_context);

// (all other repositories follow the same pattern)

public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    => await _context.SaveChangesAsync(cancellationToken);

public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    => _transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

public async Task CommitTransactionAsync(CancellationToken cancellationToken = default)
{
    if (_transaction != null) await _transaction.CommitAsync(cancellationToken);
}

public async Task RollbackTransactionAsync(CancellationToken cancellationToken = default)
{
    if (_transaction != null) await _transaction.RollbackAsync(cancellationToken);
}
```

`UnitOfWork` is registered as `Scoped`, so each HTTP request gets its own instance and `DbContext`.

## Migrations

Current migrations are in `server/StudyPlatform.Infrastructure/Migrations`. Recent schema additions include general chat conversations, YouTube transcript storage, FSRS spaced repetition, flashcard card type/classification, quiz difficulty, and worked-problem mastery.

There is also an older `server/StudyPlatform.Infrastructure/Data/Migrations` folder. The active migration set used by the project is the one under `Infrastructure/Migrations`.
