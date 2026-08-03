using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// The irreversible half of account deletion.
///
/// <para>Deletes explicitly, table by table, rather than dropping the user row and trusting the
/// cascade. The FK graph here is not uniformly cascading — documents and videos point at their user
/// with <c>NoAction</c> and reach deletion only via their course — so a single delete would either
/// fail on a constraint or, worse, succeed while leaving rows whose owner no longer exists. An
/// explicit order is auditable: you can read this method and say what survives, which is the whole
/// question a deletion feature has to answer.</para>
///
/// <para>Runs inside one transaction, so a failure part-way leaves the account intact and the worker
/// can retry rather than leaving a half-erased user.</para>
/// </summary>
public class AccountEraser : IAccountEraser
{
    private readonly AppDbContext _db;
    private readonly IBlobStorageService _blobStorage;
    private readonly ILogger<AccountEraser> _logger;

    public AccountEraser(AppDbContext db, IBlobStorageService blobStorage, ILogger<AccountEraser> logger)
    {
        _db = db;
        _blobStorage = blobStorage;
        _logger = logger;
    }

    public async Task<bool> EraseAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);
        if (user == null)
            return false;

        await DeleteBlobsAsync(userId, cancellationToken);

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        // Leaf rows first, working up to the aggregates that own them.
        await _db.FlashcardReviewLogs.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.FlashcardSrs.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.Flashcards.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        await _db.GlossaryMastered.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.GlossaryTerms.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        await _db.WorkedProblemAttempts.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.WorkedProblemMastered.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.WorkedProblems.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        await _db.QuizAttempts.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.QuizSubmissions.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.Quizzes.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        await _db.MistakeEntries.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.DocumentAnnotations.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.ContentEmbeddings.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.Notes.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        // Reviews the user wrote, and reviews of the user's own drafts. Both, because the FK from
        // reviewer is Restrict — leaving those rows behind would block the user delete outright.
        await _db.EssayPeerReviews.Where(r => r.ReviewerUserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.EssayPeerReviews
            .Where(r => _db.EssaySubmissions.Where(e => e.UserId == userId)
                .Select(e => e.EssaySubmissionId).Contains(r.EssaySubmissionId))
            .ExecuteDeleteAsync(cancellationToken);
        await _db.EssaySubmissions.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.Rubrics.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        await _db.ChatMessages.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.ChatConversations.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        // VideoTranscriptEntries is deliberately left alone. It is keyed by the source site's video
        // id, not the internal one, so its rows are a shared cache of public transcripts rather than
        // anything belonging to this user — and it expires on its own. Deleting by it would evict
        // other users' cache entries for the same video.
        await _db.Videos.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.CourseAudioOverviews.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.Documents.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.ConceptLinks.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.Courses.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        await _db.ExamPlans.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.StudySessions.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.StreakCoverDays.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        await _db.GroupAssignmentCompletions.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.GroupChatMessages.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.GroupNotes.Where(x => x.CreatedBy == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.QuizBattleEntries.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.StudyGroupMembers.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.StudyGroupSharedCourses.Where(x => x.SharedByUserId == userId).ExecuteDeleteAsync(cancellationToken);

        // Groups, classrooms, and organizations the user owned go with them. Leaving an ownerless
        // group behind would strand its members under an account that no longer exists.
        var groupIds = await _db.StudyGroups
            .Where(g => g.OwnerId == userId)
            .Select(g => g.StudyGroupId)
            .ToListAsync(cancellationToken);

        if (groupIds.Count > 0)
        {
            await _db.GroupAssignmentCompletions
                .Where(c => _db.GroupAssignments
                    .Where(a => groupIds.Contains(a.GroupId))
                    .Select(a => a.GroupAssignmentId)
                    .Contains(c.AssignmentId))
                .ExecuteDeleteAsync(cancellationToken);
            await _db.GroupAssignments.Where(a => groupIds.Contains(a.GroupId)).ExecuteDeleteAsync(cancellationToken);
            await _db.QuizBattleEntries
                .Where(e => _db.QuizBattles
                    .Where(b => groupIds.Contains(b.GroupId))
                    .Select(b => b.QuizBattleId)
                    .Contains(e.BattleId))
                .ExecuteDeleteAsync(cancellationToken);
            await _db.QuizBattles.Where(b => groupIds.Contains(b.GroupId)).ExecuteDeleteAsync(cancellationToken);
            await _db.GroupNotes.Where(n => groupIds.Contains(n.GroupId)).ExecuteDeleteAsync(cancellationToken);
            await _db.GroupChatMessages.Where(m => groupIds.Contains(m.GroupId)).ExecuteDeleteAsync(cancellationToken);
            await _db.StudyGroupSharedCourses.Where(s => groupIds.Contains(s.GroupId)).ExecuteDeleteAsync(cancellationToken);
            await _db.StudyGroupMembers.Where(m => groupIds.Contains(m.GroupId)).ExecuteDeleteAsync(cancellationToken);
            await _db.StudyGroups.Where(g => groupIds.Contains(g.StudyGroupId)).ExecuteDeleteAsync(cancellationToken);
        }

        await _db.ClassroomEnrollments.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.ClassroomSubmissions.Where(s => s.StudentUserId == userId).ExecuteDeleteAsync(cancellationToken);

        // Assignments this user authored in someone else's classroom. ClassroomAssignments.CreatedByUserId
        // is Restrict, so leaving these behind makes the final Users delete fail outright — an instructor
        // who taught a colleague's class could not erase their account at all. Submissions to them are
        // other students' work, but the assignment they answer is about to stop existing, so they go too.
        var authoredAssignmentIds = await _db.ClassroomAssignments
            .Where(a => a.CreatedByUserId == userId)
            .Select(a => a.ClassroomAssignmentId)
            .ToListAsync(cancellationToken);

        if (authoredAssignmentIds.Count > 0)
        {
            await _db.ClassroomSubmissions
                .Where(s => authoredAssignmentIds.Contains(s.ClassroomAssignmentId))
                .ExecuteDeleteAsync(cancellationToken);
            await _db.ClassroomAssignments
                .Where(a => authoredAssignmentIds.Contains(a.ClassroomAssignmentId))
                .ExecuteDeleteAsync(cancellationToken);
        }

        var ownedClassroomIds = await _db.Classrooms
            .Where(c => c.CreatedByUserId == userId)
            .Select(c => c.ClassroomId)
            .ToListAsync(cancellationToken);

        if (ownedClassroomIds.Count > 0)
        {
            // Assignments in an owned classroom cascade from Classrooms, but their submissions are
            // deleted explicitly first so the cascade never has to run through two levels at once.
            await _db.ClassroomSubmissions
                .Where(s => _db.ClassroomAssignments
                    .Where(a => ownedClassroomIds.Contains(a.ClassroomId))
                    .Select(a => a.ClassroomAssignmentId)
                    .Contains(s.ClassroomAssignmentId))
                .ExecuteDeleteAsync(cancellationToken);
            await _db.ClassroomAssignments.Where(a => ownedClassroomIds.Contains(a.ClassroomId)).ExecuteDeleteAsync(cancellationToken);
            await _db.ClassroomCourses.Where(c => ownedClassroomIds.Contains(c.ClassroomId)).ExecuteDeleteAsync(cancellationToken);
            await _db.ClassroomEnrollments.Where(e => ownedClassroomIds.Contains(e.ClassroomId)).ExecuteDeleteAsync(cancellationToken);
            await _db.Classrooms.Where(c => ownedClassroomIds.Contains(c.ClassroomId)).ExecuteDeleteAsync(cancellationToken);
        }

        await _db.OrganizationMembers.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        var ownedOrgIds = await _db.Organizations
            .Where(o => o.OwnerId == userId)
            .Select(o => o.OrganizationId)
            .ToListAsync(cancellationToken);

        if (ownedOrgIds.Count > 0)
        {
            await _db.OrganizationMembers.Where(m => ownedOrgIds.Contains(m.OrganizationId)).ExecuteDeleteAsync(cancellationToken);
            await _db.Subscriptions.Where(s => s.OrganizationId != null && ownedOrgIds.Contains(s.OrganizationId.Value)).ExecuteDeleteAsync(cancellationToken);
            await _db.Organizations.Where(o => ownedOrgIds.Contains(o.OrganizationId)).ExecuteDeleteAsync(cancellationToken);
        }

        // Assignments first: the join has no cascade from the item side, and deleting the tags would
        // otherwise leave rows keyed on a tag id that no longer exists.
        await _db.LibraryTagAssignments
            .Where(a => _db.LibraryTags.Where(t => t.UserId == userId)
                .Select(t => t.LibraryTagId).Contains(a.LibraryTagId))
            .ExecuteDeleteAsync(cancellationToken);
        await _db.LibraryTags.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.SavedLibraryViews.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        await _db.CourseCertificates.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.ApiKeys.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.Webhooks.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.Subscriptions.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.AiJobs.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.AiUsageLogs.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.Feedbacks.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.ShareTokens.Where(x => x.OwnerId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.UserCalendarFeeds.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.UserPushSubscriptions.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.DataExportRequests.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.UserTwoFactors.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.OtpCodes.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _db.RefreshTokens.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        // Audit entries are anonymised rather than deleted. The security record of what happened —
        // failed sign-ins, admin access — has value beyond the account, and it stops being personal
        // data once the ids are gone. The user row is deleted next, so the ids would dangle anyway.
        await _db.AuditLogEntries
            .Where(e => e.ActorUserId == userId || e.SubjectUserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(e => e.ActorUserId, (Guid?)null)
                .SetProperty(e => e.SubjectUserId, (Guid?)null)
                .SetProperty(e => e.IpAddress, (string?)null)
                .SetProperty(e => e.UserAgent, (string?)null),
                cancellationToken);

        await _db.Users.Where(u => u.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation("Erased account {UserId}", userId);
        return true;
    }

    /// <summary>
    /// Removes stored files before the rows that point at them.
    ///
    /// <para>Best-effort and outside the transaction, because object storage has no part in it: a
    /// blob that fails to delete is an orphan to sweep up later, whereas letting that failure abort
    /// the erase would leave the account undeleted — the worse of the two outcomes by far.</para>
    /// </summary>
    private async Task DeleteBlobsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var blobUrls = await _db.Documents
            .Where(d => d.UserId == userId && d.BlobUrl != string.Empty)
            .Select(d => d.BlobUrl)
            .ToListAsync(cancellationToken);

        foreach (var url in blobUrls)
        {
            try
            {
                await _blobStorage.DeleteAsync(url, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete blob {BlobUrl} while erasing {UserId}", url, userId);
            }
        }
    }
}
