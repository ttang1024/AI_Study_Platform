using StudyPlatform.Application.Common;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Videos.Queries;
using Xunit;

namespace StudyPlatform.Tests.Validators;

public class PagingValidatorTests
{
    private static readonly Guid User = Guid.NewGuid();

    [Theory]
    [InlineData(1, 20, true)]
    [InlineData(1, 200, true)]     // the mobile flashcard list
    [InlineData(1, 201, false)]
    [InlineData(1, 1_000_000, false)]
    [InlineData(0, 20, false)]     // would become a negative OFFSET
    [InlineData(1, 0, false)]
    public void PagedQueries_AreBounded(int page, int pageSize, bool valid)
        => Assert.Equal(valid, new GetAllFlashcardsPagedQueryValidator()
            .Validate(new GetAllFlashcardsPagedQuery(User, page, pageSize)).IsValid);

    [Theory]
    [InlineData(500, true)]        // fetched whole to label other content
    [InlineData(501, false)]
    public void VideosLite_AllowsItsLargerPage(int pageSize, bool valid)
        => Assert.Equal(valid, new GetVideosLiteQueryValidator()
            .Validate(new GetVideosLiteQuery(User, 1, pageSize)).IsValid);
}
