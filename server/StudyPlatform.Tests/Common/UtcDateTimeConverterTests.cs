using System.Text.Json;
using StudyPlatform.API.Json;
using Xunit;

namespace StudyPlatform.Tests.Common;

public class UtcDateTimeConverterTests
{
    private static readonly JsonSerializerOptions Options = CreateOptions();

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new UtcDateTimeConverter());
        return options;
    }

    private record Payload(Guid CourseId, DateTime? DueAt);

    [Fact]
    public void Read_DateOnlyString_ProducesUtcKind()
    {
        // What <input type="date"> posts. Without the converter this deserializes to
        // Kind=Unspecified and Npgsql throws when the entity is saved to a timestamptz column.
        var json = """{"courseId":"00000000-0000-0000-0000-000000000001","dueAt":"2026-08-10"}""";

        var payload = JsonSerializer.Deserialize<Payload>(json, Options)!;

        Assert.Equal(DateTimeKind.Utc, payload.DueAt!.Value.Kind);
        Assert.Equal(new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc), payload.DueAt.Value);
    }

    [Fact]
    public void Read_NullNullableDateTime_StaysNull()
    {
        var json = """{"courseId":"00000000-0000-0000-0000-000000000001","dueAt":null}""";

        var payload = JsonSerializer.Deserialize<Payload>(json, Options)!;

        Assert.Null(payload.DueAt);
    }

    [Fact]
    public void Read_OffsetString_ConvertsToUtcInstant()
    {
        var json = """{"courseId":"00000000-0000-0000-0000-000000000001","dueAt":"2026-08-10T02:00:00+02:00"}""";

        var payload = JsonSerializer.Deserialize<Payload>(json, Options)!;

        Assert.Equal(DateTimeKind.Utc, payload.DueAt!.Value.Kind);
        Assert.Equal(new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc), payload.DueAt.Value);
    }

    [Fact]
    public void Write_UnspecifiedKind_EmitsExplicitZ()
    {
        var payload = new Payload(Guid.Empty, new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Unspecified));

        var json = JsonSerializer.Serialize(payload, Options);

        Assert.Contains("2026-08-10T00:00:00Z", json);
    }

    [Theory]
    [InlineData(DateTimeKind.Unspecified)]
    [InlineData(DateTimeKind.Utc)]
    [InlineData(DateTimeKind.Local)]
    public void ToUtc_AlwaysReturnsUtcKind(DateTimeKind kind)
    {
        var value = DateTime.SpecifyKind(new DateTime(2026, 8, 10, 12, 0, 0), kind);

        Assert.Equal(DateTimeKind.Utc, UtcDateTimeConverter.ToUtc(value).Kind);
    }

    [Fact]
    public void ToUtc_UnspecifiedIsTreatedAsUtc_NotServerLocalTime()
    {
        var value = new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Unspecified);

        // A calendar date must not shift by a day based on where the API happens to run.
        Assert.Equal(new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc), UtcDateTimeConverter.ToUtc(value));
    }
}
