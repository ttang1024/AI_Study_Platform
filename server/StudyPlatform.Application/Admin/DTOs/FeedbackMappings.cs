namespace StudyPlatform.Application.Admin.DTOs;

public static class FeedbackMappings
{
    public static FeedbackItemDto ToDto(this Domain.Entities.Feedback f) => new(
        f.Id, f.Type, f.Status, f.Subject, f.Message,
        f.Rating, f.SubmittedAt, f.UserId, f.UserEmail, f.AdminNote, f.ResolvedAt);
}
