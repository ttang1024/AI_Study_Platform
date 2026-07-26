using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

/// <summary>
/// Builds the instructor gradebook straight against the DbContext.
///
/// The shape of the query is dictated by how submissions are stored: a QuizSubmission points at a
/// Document or a Video, not at a Course, so course attribution has to go through the content tables.
/// Those id sets are resolved once up front and reused, rather than joined per student — a class of
/// 200 with 5 assigned courses would otherwise fan out to 1000 round trips.
/// </summary>
public class ClassroomGradebookRepository : IClassroomGradebookRepository
{
    private readonly AppDbContext _db;

    public ClassroomGradebookRepository(AppDbContext db) => _db = db;

    public async Task<ClassroomGradebook> GetGradebookAsync(Guid classroomId, CancellationToken ct = default)
    {
        var courses = await LoadCoursesAsync(classroomId, ct);
        var students = await _db.ClassroomEnrollments
            .AsNoTracking()
            .Where(e => e.ClassroomId == classroomId
                        && e.RemovedAt == null
                        && e.Role == ClassroomRoles.Student)
            .Select(e => new { e.UserId, e.User.FullName, e.User.Email })
            .OrderBy(e => e.FullName)
            .ToListAsync(ct);

        if (courses.Count == 0 || students.Count == 0)
        {
            return new ClassroomGradebook(
                classroomId,
                courses.Select(c => new GradebookCourse(c.CourseId, c.CourseName, c.DueAt)).ToList(),
                students.Select(s => new GradebookRow(
                    s.UserId, s.FullName, s.Email,
                    Array.Empty<GradebookCell>(), null, 0, null)).ToList());
        }

        var courseIds = courses.Select(c => c.CourseId).ToList();
        var studentIds = students.Select(s => s.UserId).ToList();

        var content = await LoadCourseContentMapAsync(courseIds, ct);
        var stats = await LoadStatsAsync(courseIds, studentIds, content, ct);

        var rows = students.Select(s =>
        {
            var cells = courses
                .Select(c => stats.GetValueOrDefault((s.UserId, c.CourseId)) ?? EmptyCell(c.CourseId))
                .ToList();

            // Overall is weighted by submission count, not a mean of per-course means: a student who
            // answered 40 questions in one course and 2 in another should not have the second count
            // for half their grade.
            var scored = cells.Where(c => c.AverageScorePercent.HasValue && c.QuizSubmissions > 0).ToList();
            double? overall = scored.Count == 0
                ? null
                : scored.Sum(c => c.AverageScorePercent!.Value * c.QuizSubmissions) / scored.Sum(c => c.QuizSubmissions);

            return new GradebookRow(
                s.UserId, s.FullName, s.Email, cells,
                overall is null ? null : Math.Round(overall.Value, 1),
                cells.Sum(c => c.StudyMinutes),
                cells.Select(c => c.LastActivityAt).Where(d => d.HasValue).DefaultIfEmpty(null).Max());
        }).ToList();

        return new ClassroomGradebook(
            classroomId,
            courses.Select(c => new GradebookCourse(c.CourseId, c.CourseName, c.DueAt)).ToList(),
            rows);
    }

    public async Task<StudentClassroomDetail?> GetStudentDetailAsync(
        Guid classroomId, Guid studentUserId, CancellationToken ct = default)
    {
        var student = await _db.ClassroomEnrollments
            .AsNoTracking()
            .Where(e => e.ClassroomId == classroomId && e.UserId == studentUserId && e.RemovedAt == null)
            .Select(e => new { e.UserId, e.User.FullName, e.User.Email })
            .FirstOrDefaultAsync(ct);

        if (student == null) return null;

        var courses = await LoadCoursesAsync(classroomId, ct);
        var courseIds = courses.Select(c => c.CourseId).ToList();
        var content = await LoadCourseContentMapAsync(courseIds, ct);
        var stats = await LoadStatsAsync(courseIds, new List<Guid> { studentUserId }, content, ct);

        var cells = courses
            .Select(c => stats.GetValueOrDefault((studentUserId, c.CourseId)) ?? EmptyCell(c.CourseId))
            .ToList();

        var allDocIds = content.Values.SelectMany(v => v.DocumentIds).Distinct().ToList();
        var allVideoIds = content.Values.SelectMany(v => v.VideoIds).Distinct().ToList();

        // Weakest topics come from worked problems, which are the only artifact carrying a topic label.
        var topicRows = await _db.WorkedProblemAttempts
            .AsNoTracking()
            .Where(a => a.UserId == studentUserId)
            .Join(_db.WorkedProblems.AsNoTracking(),
                a => a.WorkedProblemId,
                p => p.WorkedProblemId,
                (a, p) => new { a.IsCorrect, p.Topic, p.DocumentId, p.VideoId })
            .Where(x => x.Topic != null
                        && ((x.DocumentId != null && allDocIds.Contains(x.DocumentId.Value))
                            || (x.VideoId != null && allVideoIds.Contains(x.VideoId.Value))))
            .GroupBy(x => x.Topic!)
            .Select(g => new TopicMastery(
                g.Key,
                g.Count(),
                g.Count(x => x.IsCorrect == true)))
            .ToListAsync(ct);

        var weakest = topicRows
            .Where(t => t.Attempted > 0)
            .OrderBy(t => (double)t.Correct / t.Attempted)
            .ThenByDescending(t => t.Attempted)
            .Take(10)
            .ToList();

        var since = DateTime.UtcNow.Date.AddDays(-29);
        var trendRaw = await _db.StudySessions
            .AsNoTracking()
            .Where(s => s.UserId == studentUserId
                        && s.OccurredAt >= since
                        && s.CourseId != null
                        && courseIds.Contains(s.CourseId.Value))
            .GroupBy(s => s.OccurredAt.Date)
            .Select(g => new { Date = g.Key, Seconds = g.Sum(x => x.DurationSeconds) })
            .ToListAsync(ct);

        var byDay = trendRaw.ToDictionary(x => x.Date, x => (int)Math.Round(x.Seconds / 60.0));
        var trend = Enumerable.Range(0, 30)
            .Select(i => since.AddDays(i))
            .Select(d => new DailyCount(d, byDay.GetValueOrDefault(d, 0)))
            .ToList();

        return new StudentClassroomDetail(
            student.UserId, student.FullName, student.Email, cells, weakest, trend);
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private sealed record CourseRow(Guid CourseId, string CourseName, DateTime? DueAt);

    private sealed record CourseContent(List<Guid> DocumentIds, List<Guid> VideoIds);

    private static GradebookCell EmptyCell(Guid courseId) => new(courseId, 0, null, 0, 0, 0, null);

    private async Task<List<CourseRow>> LoadCoursesAsync(Guid classroomId, CancellationToken ct)
        => await _db.ClassroomCourses
            .AsNoTracking()
            .Where(cc => cc.ClassroomId == classroomId)
            .OrderBy(cc => cc.AssignedAt)
            .Select(cc => new CourseRow(cc.CourseId, cc.Course.CourseName, cc.DueAt))
            .ToListAsync(ct);

    /// <summary>
    /// Maps each course to the documents and videos it contains. Submissions reference these, not the
    /// course, so this is the join table the rest of the aggregation runs through.
    /// </summary>
    private async Task<Dictionary<Guid, CourseContent>> LoadCourseContentMapAsync(
        List<Guid> courseIds, CancellationToken ct)
    {
        var docs = await _db.Documents
            .AsNoTracking()
            .Where(d => courseIds.Contains(d.CourseId))
            .Select(d => new { d.CourseId, d.DocumentId })
            .ToListAsync(ct);

        var videos = await _db.Videos
            .AsNoTracking()
            .Where(v => courseIds.Contains(v.CourseId))
            .Select(v => new { v.CourseId, v.VideoId })
            .ToListAsync(ct);

        return courseIds.ToDictionary(
            id => id,
            id => new CourseContent(
                docs.Where(d => d.CourseId == id).Select(d => d.DocumentId).ToList(),
                videos.Where(v => v.CourseId == id).Select(v => v.VideoId).ToList()));
    }

    private async Task<Dictionary<(Guid UserId, Guid CourseId), GradebookCell>> LoadStatsAsync(
        List<Guid> courseIds,
        List<Guid> studentIds,
        Dictionary<Guid, CourseContent> content,
        CancellationToken ct)
    {
        var allDocIds = content.Values.SelectMany(c => c.DocumentIds).Distinct().ToList();
        var allVideoIds = content.Values.SelectMany(c => c.VideoIds).Distinct().ToList();

        var submissions = await _db.QuizSubmissions
            .AsNoTracking()
            .Where(s => studentIds.Contains(s.UserId)
                        && ((s.DocumentId != null && allDocIds.Contains(s.DocumentId.Value))
                            || (s.VideoId != null && allVideoIds.Contains(s.VideoId.Value))))
            .Select(s => new { s.UserId, s.DocumentId, s.VideoId, s.Score, s.Total, s.SubmittedAt })
            .ToListAsync(ct);

        var attempts = await _db.WorkedProblemAttempts
            .AsNoTracking()
            .Where(a => studentIds.Contains(a.UserId))
            .Join(_db.WorkedProblems.AsNoTracking(),
                a => a.WorkedProblemId,
                p => p.WorkedProblemId,
                (a, p) => new { a.UserId, a.IsCorrect, a.AttemptedAt, p.DocumentId, p.VideoId })
            .Where(x => (x.DocumentId != null && allDocIds.Contains(x.DocumentId.Value))
                        || (x.VideoId != null && allVideoIds.Contains(x.VideoId.Value)))
            .ToListAsync(ct);

        var sessions = await _db.StudySessions
            .AsNoTracking()
            .Where(s => studentIds.Contains(s.UserId)
                        && s.CourseId != null
                        && courseIds.Contains(s.CourseId.Value))
            .GroupBy(s => new { s.UserId, s.CourseId })
            .Select(g => new
            {
                g.Key.UserId,
                g.Key.CourseId,
                Seconds = g.Sum(x => x.DurationSeconds),
                LastAt = g.Max(x => x.OccurredAt)
            })
            .ToListAsync(ct);

        // Reverse the content map once so each submission can be attributed in O(1).
        var courseOfDoc = new Dictionary<Guid, Guid>();
        var courseOfVideo = new Dictionary<Guid, Guid>();
        foreach (var (courseId, c) in content)
        {
            foreach (var d in c.DocumentIds) courseOfDoc[d] = courseId;
            foreach (var v in c.VideoIds) courseOfVideo[v] = courseId;
        }

        Guid? Attribute(Guid? documentId, Guid? videoId)
        {
            if (documentId != null && courseOfDoc.TryGetValue(documentId.Value, out var dc)) return dc;
            if (videoId != null && courseOfVideo.TryGetValue(videoId.Value, out var vc)) return vc;
            return null;
        }

        var result = new Dictionary<(Guid, Guid), GradebookCell>();

        GradebookCell Get(Guid userId, Guid courseId)
            => result.TryGetValue((userId, courseId), out var existing) ? existing : EmptyCell(courseId);

        // Quiz submissions: percentage is computed over total questions answered across submissions,
        // so a 1-question quiz cannot outweigh a 30-question one.
        foreach (var group in submissions
                     .Select(s => new { s.UserId, CourseId = Attribute(s.DocumentId, s.VideoId), s.Score, s.Total, s.SubmittedAt })
                     .Where(s => s.CourseId != null)
                     .GroupBy(s => new { s.UserId, CourseId = s.CourseId!.Value }))
        {
            var totalQuestions = group.Sum(g => g.Total);
            var cell = Get(group.Key.UserId, group.Key.CourseId);

            result[(group.Key.UserId, group.Key.CourseId)] = cell with
            {
                QuizSubmissions = group.Count(),
                AverageScorePercent = totalQuestions == 0
                    ? null
                    : Math.Round(100.0 * group.Sum(g => g.Score) / totalQuestions, 1),
                LastActivityAt = Max(cell.LastActivityAt, group.Max(g => g.SubmittedAt))
            };
        }

        foreach (var group in attempts
                     .Select(a => new { a.UserId, CourseId = Attribute(a.DocumentId, a.VideoId), a.IsCorrect, a.AttemptedAt })
                     .Where(a => a.CourseId != null)
                     .GroupBy(a => new { a.UserId, CourseId = a.CourseId!.Value }))
        {
            var cell = Get(group.Key.UserId, group.Key.CourseId);

            result[(group.Key.UserId, group.Key.CourseId)] = cell with
            {
                ProblemsAttempted = group.Count(),
                ProblemsCorrect = group.Count(g => g.IsCorrect == true),
                LastActivityAt = Max(cell.LastActivityAt, group.Max(g => g.AttemptedAt))
            };
        }

        foreach (var s in sessions)
        {
            var courseId = s.CourseId!.Value;
            var cell = Get(s.UserId, courseId);

            result[(s.UserId, courseId)] = cell with
            {
                StudyMinutes = (long)Math.Round(s.Seconds / 60.0),
                LastActivityAt = Max(cell.LastActivityAt, s.LastAt)
            };
        }

        return result;
    }

    private static DateTime? Max(DateTime? a, DateTime b) => a is null || b > a ? b : a;
}
