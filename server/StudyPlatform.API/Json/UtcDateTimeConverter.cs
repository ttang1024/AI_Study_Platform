using System.Text.Json;
using System.Text.Json.Serialization;

namespace StudyPlatform.API.Json;

/// <summary>
/// Forces every <see cref="DateTime"/> crossing the JSON boundary to UTC.
///
/// Every timestamp column is <c>timestamp with time zone</c>, and Npgsql refuses to write a
/// <see cref="DateTime"/> whose <see cref="DateTime.Kind"/> is not <see cref="DateTimeKind.Utc"/>.
/// Clients routinely post unzoned values — an <c>&lt;input type="date"&gt;</c> sends
/// <c>"2026-08-10"</c>, which System.Text.Json parses as Kind=Unspecified — so without this the
/// request reaches the handler fine and then blows up at SaveChangesAsync with a 500.
/// Writing is normalized too, so responses always carry an explicit <c>Z</c> and the browser
/// can't reinterpret a bare timestamp as local time.
///
/// <see cref="Nullable{T}"/> properties are covered automatically: System.Text.Json's nullable
/// wrapper handles the null token itself and delegates the value to this converter.
/// </summary>
public class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => ToUtc(reader.GetDateTime());

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
        => writer.WriteStringValue(ToUtc(value));

    /// <summary>
    /// Unspecified is treated as already-UTC rather than converted from server local time: the
    /// server's zone is an accident of deployment, and the clients that send unzoned values send
    /// calendar dates, which should not shift by a day depending on where the API runs.
    /// </summary>
    public static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}
