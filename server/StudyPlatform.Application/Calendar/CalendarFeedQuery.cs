using System.Text;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Calendar;

/// <summary>
/// Builds an iCalendar (.ics) feed of the next two weeks: per-day flashcard due counts,
/// exam dates, and daily study-plan blocks — importable into Google/Apple/Outlook calendars.
/// </summary>
public record GetCalendarFeedQuery(Guid UserId) : IRequest<Result<string>>;

public class GetCalendarFeedQueryHandler : IRequestHandler<GetCalendarFeedQuery, Result<string>>
{
    private const int HorizonDays = 14;

    private readonly IUnitOfWork _unitOfWork;

    public GetCalendarFeedQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<string>> Handle(GetCalendarFeedQuery request, CancellationToken cancellationToken)
    {
        var userId = request.UserId;
        var today = DateTime.UtcNow.Date;
        var horizon = today.AddDays(HorizonDays);

        var sb = new StringBuilder();
        sb.AppendLine("BEGIN:VCALENDAR");
        sb.AppendLine("VERSION:2.0");
        sb.AppendLine("PRODID:-//Easy Study//Study Planner//EN");
        sb.AppendLine("CALSCALE:GREGORIAN");
        sb.AppendLine("X-WR-CALNAME:Easy Study");

        // Flashcards due per day (cards already overdue roll into today).
        var srs = await _unitOfWork.FlashcardSrs.FindAsync(
            s => s.UserId == userId && s.Due < horizon, cancellationToken);
        var dueByDay = srs
            .GroupBy(s => s.Due.Date < today ? today : s.Due.Date)
            .Where(g => g.Key >= today)
            .OrderBy(g => g.Key);

        foreach (var day in dueByDay)
        {
            AddAllDayEvent(sb,
                uid: $"flashcards-{day.Key:yyyyMMdd}-{userId:N}",
                date: day.Key,
                summary: $"📚 {day.Count()} flashcard{(day.Count() == 1 ? "" : "s")} due",
                description: "Spaced-repetition reviews scheduled by Easy Study.");
        }

        // Exam dates + a daily study block leading up to each exam.
        var plans = await _unitOfWork.ExamPlans.FindAsync(
            p => p.UserId == userId && p.ExamDate >= today, cancellationToken);

        foreach (var plan in plans)
        {
            AddAllDayEvent(sb,
                uid: $"exam-{plan.ExamPlanId:N}",
                date: plan.ExamDate.Date,
                summary: $"🎓 Exam: {plan.Title}",
                description: "Exam day — good luck!");

            var lastPrepDay = plan.ExamDate.Date.AddDays(-1);
            for (var d = today; d <= lastPrepDay && d < horizon; d = d.AddDays(1))
            {
                AddAllDayEvent(sb,
                    uid: $"prep-{plan.ExamPlanId:N}-{d:yyyyMMdd}",
                    date: d,
                    summary: $"✏️ Study {plan.DailyMinutes} min — {plan.Title}",
                    description: "Planned session from your Easy Study exam plan.");
            }
        }

        sb.AppendLine("END:VCALENDAR");
        return Result<string>.Success(sb.ToString());
    }

    private static void AddAllDayEvent(StringBuilder sb, string uid, DateTime date, string summary, string description)
    {
        sb.AppendLine("BEGIN:VEVENT");
        sb.AppendLine($"UID:{uid}@easystudy");
        sb.AppendLine($"DTSTAMP:{DateTime.UtcNow:yyyyMMdd'T'HHmmss'Z'}");
        sb.AppendLine($"DTSTART;VALUE=DATE:{date:yyyyMMdd}");
        sb.AppendLine($"DTEND;VALUE=DATE:{date.AddDays(1):yyyyMMdd}");
        sb.AppendLine($"SUMMARY:{Escape(summary)}");
        sb.AppendLine($"DESCRIPTION:{Escape(description)}");
        sb.AppendLine("END:VEVENT");
    }

    private static string Escape(string value) =>
        value.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\n", "\\n");
}
