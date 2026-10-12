using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Common;

public class PagingTests
{
    [Theory]
    [InlineData(0, 10, 1, 10)]      // page 0 used to become OFFSET -10 → a Postgres error
    [InlineData(-5, 10, 1, 10)]
    [InlineData(2, 0, 2, 1)]        // pageSize 0 used to divide by zero computing total pages
    [InlineData(1, 1_000_000, 1, Paging.MaxPageSize)]
    [InlineData(3, 25, 3, 25)]
    public void Normalize_BoundsPageAndSize(int page, int size, int expectedPage, int expectedSize)
        => Assert.Equal((expectedPage, expectedSize), Paging.Normalize(page, size));

    [Fact]
    public void Page_ReturnsTheRequestedSlice()
        => Assert.Equal([21, 22, 23, 24, 25], Enumerable.Range(1, 100).AsQueryable().Page(5, 5).ToArray());
}
