using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Builds Anki .apkg packages: a zip holding a schema-11 "collection.anki2" SQLite database
/// plus an (empty) media map. Scheduling state is carried over so exported decks keep their
/// intervals: FSRS Review cards become Anki review cards with the same interval/due date,
/// Learning/Relearning cards become due reviews with a 1-day interval, new cards stay new.
/// </summary>
public class AnkiExportService : IAnkiExportService
{
    private const char FieldSeparator = '\u001f';

    public byte[] BuildPackage(string deckName, IReadOnlyList<AnkiExportCard> cards)
    {
        var dbFile = Path.Combine(Path.GetTempPath(), $"anki-export-{Guid.NewGuid():N}.anki2");
        try
        {
            BuildCollection(dbFile, deckName, cards);

            using var zipStream = new MemoryStream();
            using (var zip = new ZipArchive(zipStream, ZipArchiveMode.Create, leaveOpen: true))
            {
                zip.CreateEntryFromFile(dbFile, "collection.anki2");
                using var media = new StreamWriter(zip.CreateEntry("media").Open());
                media.Write("{}");
            }
            return zipStream.ToArray();
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            if (File.Exists(dbFile)) File.Delete(dbFile);
        }
    }

    private static void BuildCollection(string dbFile, string deckName, IReadOnlyList<AnkiExportCard> cards)
    {
        var now = DateTimeOffset.UtcNow;
        var nowMs = now.ToUnixTimeMilliseconds();
        var nowSec = now.ToUnixTimeSeconds();
        // Collection creation time: today at 04:00 UTC (Anki aligns "days" to the rollover hour).
        var crt = new DateTimeOffset(now.Date, TimeSpan.Zero).AddHours(4).ToUnixTimeSeconds();
        var modelId = nowMs;
        var deckId = nowMs + 1;

        using var connection = new SqliteConnection($"Data Source={dbFile}");
        connection.Open();

        Execute(connection, Schema);

        var conf = JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["nextPos"] = 1, ["estTimes"] = true, ["activeDecks"] = new[] { 1L }, ["sortType"] = "noteFld",
            ["timeLim"] = 0, ["sortBackwards"] = false, ["addToCur"] = true,
            ["curDeck"] = 1, ["newBury"] = true, ["newSpread"] = 0, ["dueCounts"] = true,
            ["curModel"] = modelId.ToString(), ["collapseTime"] = 1200,
        });

        var models = JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            [modelId.ToString()] = new Dictionary<string, object?>
            {
                ["id"] = modelId, ["name"] = "Basic (Study Platform)", ["type"] = 0, ["mod"] = nowSec,
                ["usn"] = -1, ["sortf"] = 0, ["did"] = deckId, ["tags"] = Array.Empty<string>(),
                ["vers"] = Array.Empty<object>(), ["latexPre"] = LatexPre, ["latexPost"] = "\\end{document}",
                ["css"] = ".card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }",
                ["flds"] = new object[]
                {
                    new Dictionary<string, object?> { ["name"] = "Front", ["ord"] = 0, ["sticky"] = false, ["rtl"] = false, ["font"] = "Arial", ["size"] = 20, ["media"] = Array.Empty<object>() },
                    new Dictionary<string, object?> { ["name"] = "Back", ["ord"] = 1, ["sticky"] = false, ["rtl"] = false, ["font"] = "Arial", ["size"] = 20, ["media"] = Array.Empty<object>() },
                },
                ["tmpls"] = new object[]
                {
                    new Dictionary<string, object?>
                    {
                        ["name"] = "Card 1", ["ord"] = 0, ["qfmt"] = "{{Front}}",
                        ["afmt"] = "{{FrontSide}}\n<hr id=answer>\n{{Back}}",
                        ["bqfmt"] = "", ["bafmt"] = "", ["did"] = null,
                    },
                },
                ["req"] = new object[] { new object[] { 0, "any", new[] { 0 } } },
            },
        });

        var decks = JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["1"] = DeckJson(1, "Default", nowSec),
            [deckId.ToString()] = DeckJson(deckId, deckName, nowSec),
        });

        var dconf = JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["1"] = new Dictionary<string, object?>
            {
                ["id"] = 1, ["name"] = "Default", ["mod"] = 0, ["usn"] = 0, ["maxTaken"] = 60, ["autoplay"] = true,
                ["timer"] = 0, ["replayq"] = true, ["dyn"] = false,
                ["new"] = new Dictionary<string, object?> { ["bury"] = true, ["delays"] = new[] { 1.0, 10.0 }, ["initialFactor"] = 2500, ["ints"] = new[] { 1, 4, 7 }, ["order"] = 1, ["perDay"] = 20, ["separate"] = true },
                ["rev"] = new Dictionary<string, object?> { ["bury"] = true, ["ease4"] = 1.3, ["fuzz"] = 0.05, ["ivlFct"] = 1.0, ["maxIvl"] = 36500, ["minSpace"] = 1, ["perDay"] = 200 },
                ["lapse"] = new Dictionary<string, object?> { ["delays"] = new[] { 10.0 }, ["leechAction"] = 0, ["leechFails"] = 8, ["minInt"] = 1, ["mult"] = 0.0 },
            },
        });

        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "INSERT INTO col VALUES (1, @crt, @mod, @scm, 11, 0, 0, 0, @conf, @models, @decks, @dconf, '{}')";
            cmd.Parameters.AddWithValue("@crt", crt);
            cmd.Parameters.AddWithValue("@mod", nowMs);
            cmd.Parameters.AddWithValue("@scm", nowMs);
            cmd.Parameters.AddWithValue("@conf", conf);
            cmd.Parameters.AddWithValue("@models", models);
            cmd.Parameters.AddWithValue("@decks", decks);
            cmd.Parameters.AddWithValue("@dconf", dconf);
            cmd.ExecuteNonQuery();
        }

        using var transaction = connection.BeginTransaction();
        var noteId = nowMs;
        var cardId = nowMs + 500_000;
        var newPosition = 0;

        foreach (var card in cards)
        {
            noteId++;
            cardId++;

            var front = Sanitize(card.Front);
            var back = Sanitize(card.Back);
            var tags = card.Tags.Count > 0 ? " " + string.Join(" ", card.Tags.Select(t => t.Replace(' ', '_'))) + " " : "";

            using (var cmd = connection.CreateCommand())
            {
                cmd.Transaction = transaction;
                cmd.CommandText = "INSERT INTO notes VALUES (@id, @guid, @mid, @mod, -1, @tags, @flds, @sfld, @csum, 0, '')";
                cmd.Parameters.AddWithValue("@id", noteId);
                cmd.Parameters.AddWithValue("@guid", StableGuid(card.FlashcardId));
                cmd.Parameters.AddWithValue("@mid", modelId);
                cmd.Parameters.AddWithValue("@mod", nowSec);
                cmd.Parameters.AddWithValue("@tags", tags);
                cmd.Parameters.AddWithValue("@flds", front + FieldSeparator + back);
                cmd.Parameters.AddWithValue("@sfld", front);
                cmd.Parameters.AddWithValue("@csum", FieldChecksum(front));
                cmd.ExecuteNonQuery();
            }

            // Map FSRS state to Anki scheduling.
            int type, queue;
            long due;
            var ivl = Math.Max(card.IntervalDays ?? 0, 0);
            if (card.SrsState is null or 0)
            {
                type = 0; queue = 0; due = ++newPosition; ivl = 0;
            }
            else
            {
                // Review/Learning/Relearning all export as review cards; learning collapses to a 1-day interval.
                type = 2; queue = 2;
                ivl = card.SrsState == 2 ? Math.Max(ivl, 1) : 1;
                var dueDays = card.Due.HasValue
                    ? (long)Math.Max(0, Math.Round((card.Due.Value.Date - DateTimeOffset.FromUnixTimeSeconds(crt).UtcDateTime.Date).TotalDays))
                    : 0;
                due = dueDays;
            }

            using (var cmd = connection.CreateCommand())
            {
                cmd.Transaction = transaction;
                cmd.CommandText = "INSERT INTO cards VALUES (@id, @nid, @did, 0, @mod, -1, @type, @queue, @due, @ivl, @factor, @reps, @lapses, 0, 0, 0, 0, '')";
                cmd.Parameters.AddWithValue("@id", cardId);
                cmd.Parameters.AddWithValue("@nid", noteId);
                cmd.Parameters.AddWithValue("@did", deckId);
                cmd.Parameters.AddWithValue("@mod", nowSec);
                cmd.Parameters.AddWithValue("@type", type);
                cmd.Parameters.AddWithValue("@queue", queue);
                cmd.Parameters.AddWithValue("@due", due);
                cmd.Parameters.AddWithValue("@ivl", ivl);
                cmd.Parameters.AddWithValue("@factor", type == 2 ? 2500 : 0);
                cmd.Parameters.AddWithValue("@reps", card.Reps ?? 0);
                cmd.Parameters.AddWithValue("@lapses", card.Lapses ?? 0);
                cmd.ExecuteNonQuery();
            }
        }

        transaction.Commit();
    }

    private static Dictionary<string, object?> DeckJson(long id, string name, long nowSec) => new()
    {
        ["id"] = id, ["name"] = name, ["mod"] = nowSec, ["usn"] = -1, ["desc"] = "", ["dyn"] = 0, ["conf"] = 1,
        ["collapsed"] = false, ["extendNew"] = 10, ["extendRev"] = 50,
        ["newToday"] = new[] { 0, 0 }, ["revToday"] = new[] { 0, 0 }, ["lrnToday"] = new[] { 0, 0 }, ["timeToday"] = new[] { 0, 0 },
    };

    /// <summary>Anki note fields may contain HTML but never the 0x1f field separator.</summary>
    private static string Sanitize(string text)
        => (text ?? string.Empty).Replace(FieldSeparator, ' ').Replace("\n", "<br>");

    /// <summary>Stable 10-char note GUID so re-imports update instead of duplicating.</summary>
    private static string StableGuid(Guid flashcardId)
        => Convert.ToBase64String(flashcardId.ToByteArray())[..10];

    /// <summary>Anki's field checksum: first 8 hex chars of SHA1 of the stripped first field, as integer.</summary>
    private static long FieldChecksum(string field)
    {
        var stripped = StripHtml(field);
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(stripped));
        return Convert.ToInt64(Convert.ToHexString(hash)[..8], 16);
    }

    private static string StripHtml(string html)
    {
        var sb = new StringBuilder(html.Length);
        var inTag = false;
        foreach (var c in html)
        {
            if (c == '<') inTag = true;
            else if (c == '>') inTag = false;
            else if (!inTag) sb.Append(c);
        }
        return sb.ToString();
    }

    private static void Execute(SqliteConnection connection, string sql)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }

    private const string LatexPre = "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n";

    private const string Schema = """
        CREATE TABLE col (
            id integer primary key, crt integer not null, mod integer not null, scm integer not null,
            ver integer not null, dty integer not null, usn integer not null, ls integer not null,
            conf text not null, models text not null, decks text not null, dconf text not null, tags text not null
        );
        CREATE TABLE notes (
            id integer primary key, guid text not null, mid integer not null, mod integer not null,
            usn integer not null, tags text not null, flds text not null, sfld text not null,
            csum integer not null, flags integer not null, data text not null
        );
        CREATE TABLE cards (
            id integer primary key, nid integer not null, did integer not null, ord integer not null,
            mod integer not null, usn integer not null, type integer not null, queue integer not null,
            due integer not null, ivl integer not null, factor integer not null, reps integer not null,
            lapses integer not null, left integer not null, odue integer not null, odid integer not null,
            flags integer not null, data text not null
        );
        CREATE TABLE revlog (
            id integer primary key, cid integer not null, usn integer not null, ease integer not null,
            ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null,
            type integer not null
        );
        CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
        CREATE INDEX ix_notes_usn on notes (usn);
        CREATE INDEX ix_cards_usn on cards (usn);
        CREATE INDEX ix_revlog_usn on revlog (usn);
        CREATE INDEX ix_cards_nid on cards (nid);
        CREATE INDEX ix_cards_sched on cards (did, queue, due);
        CREATE INDEX ix_revlog_cid on revlog (cid);
        CREATE INDEX ix_notes_csum on notes (csum);
        """;
}
