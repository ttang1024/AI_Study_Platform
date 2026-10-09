using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Auth.Validators;
using StudyPlatform.Application.Feedback.Commands;
using StudyPlatform.Application.Feedback.Validators;
using StudyPlatform.Application.LibraryTags.Commands;
using StudyPlatform.Application.LibraryTags.Validators;
using StudyPlatform.Application.Notes.Commands;
using StudyPlatform.Application.Notes.Validators;
using Xunit;

namespace StudyPlatform.Tests.Validators;

/// <summary>Oversized text must be a 400 at the door, not a column-length failure inside SaveChanges.</summary>
public class ContentValidatorTests
{
    private static readonly Guid User = Guid.NewGuid();

    [Fact]
    public void Feedback_RejectsOverlongSubject_AndOutOfRangeRating()
    {
        var v = new SubmitFeedbackValidator();
        Assert.True(v.Validate(new SubmitFeedbackCommand("bug", "Title", "Body", 5, User, null)).IsValid);
        Assert.True(v.Validate(new SubmitFeedbackCommand("bug", "Title", "Body", null, User, null)).IsValid);
        Assert.False(v.Validate(new SubmitFeedbackCommand("bug", new string('x', 201), "Body", null, User, null)).IsValid);
        Assert.False(v.Validate(new SubmitFeedbackCommand("bug", "Title", "Body", 6, User, null)).IsValid);
    }

    [Fact]
    public void LibraryTag_NameIsBoundedByItsColumn()
    {
        var v = new CreateLibraryTagValidator();
        Assert.True(v.Validate(new CreateLibraryTagCommand(User, "exam", "tag", null, null)).IsValid);
        Assert.False(v.Validate(new CreateLibraryTagCommand(User, new string('x', 65), "tag", null, null)).IsValid);
    }

    [Fact]
    public void Note_TitleIsBounded()
    {
        var v = new CreateNoteValidator();
        Assert.True(v.Validate(new CreateNoteCommand(User, "<p>hi</p>", "Title")).IsValid);
        Assert.False(v.Validate(new CreateNoteCommand(User, "<p>hi</p>", new string('x', 501))).IsValid);
    }

    [Fact]
    public void Profile_NameIsRequiredAndBounded()
    {
        var v = new UpdateProfileValidator();
        Assert.False(v.Validate(new UpdateProfileCommand(User, "")).IsValid);
        Assert.False(v.Validate(new UpdateProfileCommand(User, new string('x', 201))).IsValid);
        Assert.True(v.Validate(new UpdateProfileCommand(User, "Ada Lovelace")).IsValid);
    }
}
