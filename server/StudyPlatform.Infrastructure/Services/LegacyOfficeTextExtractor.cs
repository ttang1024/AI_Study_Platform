using System.Text;
using OpenMcdf;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Text extraction for the legacy binary Office formats (.doc per [MS-DOC],
/// .ppt per [MS-PPT]), which are OLE compound files rather than OpenXML zips.
/// </summary>
internal static class LegacyOfficeTextExtractor
{
    // ── Word 97-2003 (.doc) ───────────────────────────────────────────────

    public static string ExtractDocText(byte[] data)
    {
        using var ms = new MemoryStream(data);
        using var root = RootStorage.Open(ms);
        var wd = ReadStream(root, "WordDocument");
        if (wd.Length < 0x200 || BitConverter.ToUInt16(wd, 0) != 0xA5EC)
            return string.Empty;

        // FIB flag bit fWhichTblStm selects which table stream holds the CLX.
        var flags = BitConverter.ToUInt16(wd, 0x000A);
        var tableName = (flags & 0x0200) != 0 ? "1Table" : "0Table";
        var table = ReadStream(root, tableName);

        var fcClx = BitConverter.ToInt32(wd, 0x01A2);
        var lcbClx = BitConverter.ToInt32(wd, 0x01A6);
        if (fcClx < 0 || lcbClx <= 0 || fcClx + lcbClx > table.Length)
            return string.Empty;

        // CLX = zero or more Prc entries (0x01) followed by the Pcdt (0x02),
        // which holds the piece table (PlcPcd).
        var pos = fcClx;
        var clxEnd = fcClx + lcbClx;
        while (pos < clxEnd && table[pos] == 0x01)
            pos += 3 + BitConverter.ToInt16(table, pos + 1);
        if (pos + 5 > clxEnd || table[pos] != 0x02)
            return string.Empty;

        var lcbPlcPcd = BitConverter.ToInt32(table, pos + 1);
        pos += 5;
        var pieceCount = (lcbPlcPcd - 4) / 12;
        if (pieceCount <= 0 || pos + lcbPlcPcd > clxEnd)
            return string.Empty;

        var cpBase = pos;
        var pcdBase = pos + 4 * (pieceCount + 1);

        var sb = new StringBuilder();
        for (var i = 0; i < pieceCount; i++)
        {
            var cpStart = BitConverter.ToInt32(table, cpBase + 4 * i);
            var cpEnd = BitConverter.ToInt32(table, cpBase + 4 * (i + 1));
            var charCount = cpEnd - cpStart;
            if (charCount <= 0)
                continue;

            // PCD: 2 bytes of flags, then FcCompressed (bit 30 = 8-bit text).
            var fcRaw = BitConverter.ToUInt32(table, pcdBase + 8 * i + 2);
            var compressed = (fcRaw & 0x4000_0000) != 0;
            var fc = (int)(fcRaw & 0x3FFF_FFFF);

            if (compressed)
            {
                fc /= 2;
                if (fc + charCount > wd.Length) continue;
                for (var k = 0; k < charCount; k++)
                    sb.Append(Cp1252Char(wd[fc + k]));
            }
            else
            {
                if (fc + charCount * 2 > wd.Length) continue;
                sb.Append(Encoding.Unicode.GetString(wd, fc, charCount * 2));
            }
        }

        return CleanWordText(sb);
    }

    private static string CleanWordText(StringBuilder raw)
    {
        var sb = new StringBuilder(raw.Length);
        for (var i = 0; i < raw.Length; i++)
        {
            var c = raw[i];
            switch (c)
            {
                case '\r' or '\v' or '\f': sb.Append('\n'); break;  // para / line / page break
                case '': sb.Append('\t'); break;              // table cell/row mark
                case '': sb.Append('-'); break;               // non-breaking hyphen
                case '': break;                               // optional hyphen
                case '' or '' or '': break;       // field chars
                case '\t': sb.Append('\t'); break;
                default:
                    if (c >= ' ' || c == '\n') sb.Append(c);
                    break;
            }
        }
        return sb.ToString();
    }

    // Windows-1252 maps onto Latin-1 except for the 0x80-0x9F block.
    private static readonly char[] Cp1252High =
    [
        '€', '', '‚', 'ƒ', '„', '…', '†', '‡',
        'ˆ', '‰', 'Š', '‹', 'Œ', '', 'Ž', '',
        '', '‘', '’', '“', '”', '•', '–', '—',
        '˜', '™', 'š', '›', 'œ', '', 'ž', 'Ÿ',
    ];

    internal static char Cp1252Char(byte b) =>
        b is >= 0x80 and <= 0x9F ? Cp1252High[b - 0x80] : (char)b;

    // ── PowerPoint 97-2003 (.ppt) ─────────────────────────────────────────

    private const ushort TextCharsAtom = 0x0FA0;  // UTF-16LE
    private const ushort TextBytesAtom = 0x0FA8;  // cp1252

    public static string ExtractPptText(byte[] data)
    {
        using var ms = new MemoryStream(data);
        using var root = RootStorage.Open(ms);
        var ppt = ReadStream(root, "PowerPoint Document");

        var sb = new StringBuilder();
        WalkRecords(ppt, 0, ppt.Length, sb);
        return sb.ToString();
    }

    private static byte[] ReadStream(RootStorage root, string name)
    {
        using var stream = root.OpenStream(name);
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }

    // ── Excel 97-2003 (.xls, BIFF8) ───────────────────────────────────────

    private const ushort BiffSst = 0x00FC;
    private const ushort BiffContinue = 0x003C;
    private const ushort BiffLabel = 0x0204;

    /// <summary>
    /// Pulls the cell text out of a legacy Excel workbook: the BIFF8 shared
    /// string table (SST, including CONTINUE-spanning strings) plus inline
    /// LABEL records from older BIFF5 files. Table structure is not preserved.
    /// </summary>
    public static string ExtractXlsText(byte[] data)
    {
        using var ms = new MemoryStream(data);
        using var root = RootStorage.Open(ms);
        var streamName = root.EnumerateEntries().Any(e => e.Name == "Workbook") ? "Workbook" : "Book";
        var wb = ReadStream(root, streamName);

        var strings = new List<string>();
        var pos = 0;
        while (pos + 4 <= wb.Length)
        {
            var recType = BitConverter.ToUInt16(wb, pos);
            int recLen = BitConverter.ToUInt16(wb, pos + 2);
            if (pos + 4 + recLen > wb.Length)
                break;

            if (recType == BiffSst)
            {
                var cursor = new BiffCursor(wb, pos);
                cursor.Skip(4); // cstTotal
                var unique = cursor.ReadInt32();
                for (var i = 0; i < unique; i++)
                {
                    var s = cursor.ReadString();
                    if (s == null) break;
                    strings.Add(s);
                }
            }
            else if (recType == BiffLabel && recLen >= 8)
            {
                // BIFF5 inline label: row(2) col(2) xf(2) cch(2) chars
                int cch = BitConverter.ToUInt16(wb, pos + 10);
                var available = Math.Min(cch, recLen - 8);
                var sb = new StringBuilder(available);
                for (var k = 0; k < available; k++)
                    sb.Append(Cp1252Char(wb[pos + 12 + k]));
                strings.Add(sb.ToString());
            }

            pos += 4 + recLen;
        }

        return string.Join("\n", strings.Where(s => !string.IsNullOrWhiteSpace(s)));
    }

    // Reads XLUnicodeRichExtendedString values from an SST record, following
    // into CONTINUE records where strings span record boundaries.
    private sealed class BiffCursor
    {
        private readonly byte[] _data;
        private int _pos;
        private int _recEnd;

        public BiffCursor(byte[] data, int recordHeaderPos)
        {
            _data = data;
            _pos = recordHeaderPos + 4;
            _recEnd = _pos + BitConverter.ToUInt16(data, recordHeaderPos + 2);
        }

        private int Remaining => _recEnd - _pos;

        private bool NextContinue()
        {
            var headerPos = _recEnd;
            if (headerPos + 4 > _data.Length || BitConverter.ToUInt16(_data, headerPos) != BiffContinue)
                return false;
            var len = BitConverter.ToUInt16(_data, headerPos + 2);
            _pos = headerPos + 4;
            _recEnd = _pos + len;
            return _recEnd <= _data.Length;
        }

        private bool Ensure(int count)
        {
            while (Remaining == 0)
                if (!NextContinue()) return false;
            return Remaining >= count;
        }

        private byte ReadByte() { Ensure(1); return _data[_pos++]; }
        private ushort ReadUInt16() { Ensure(2); var v = BitConverter.ToUInt16(_data, _pos); _pos += 2; return v; }
        public int ReadInt32() { Ensure(4); var v = BitConverter.ToInt32(_data, _pos); _pos += 4; return v; }

        public void Skip(int count)
        {
            while (count > 0)
            {
                if (Remaining == 0 && !NextContinue()) return;
                var take = Math.Min(count, Remaining);
                _pos += take;
                count -= take;
            }
        }

        public string? ReadString()
        {
            if (!Ensure(3)) return null;
            int cch = ReadUInt16();
            var flags = ReadByte();
            var highByte = (flags & 0x01) != 0;
            var hasExt = (flags & 0x04) != 0;
            var hasRich = (flags & 0x08) != 0;
            int runCount = hasRich ? ReadUInt16() : 0;
            var extLength = hasExt ? ReadInt32() : 0;

            var sb = new StringBuilder(cch);
            var remainingChars = cch;
            while (remainingChars > 0)
            {
                if (Remaining == 0)
                {
                    // A string continued into the next record restates the
                    // high-byte flag as the record's first byte.
                    if (!NextContinue()) break;
                    highByte = (ReadByte() & 0x01) != 0;
                    continue;
                }

                if (highByte)
                {
                    var take = Math.Min(remainingChars, Remaining / 2);
                    if (take == 0) break; // malformed: odd byte left
                    sb.Append(Encoding.Unicode.GetString(_data, _pos, take * 2));
                    _pos += take * 2;
                    remainingChars -= take;
                }
                else
                {
                    var take = Math.Min(remainingChars, Remaining);
                    for (var k = 0; k < take; k++)
                        sb.Append(Cp1252Char(_data[_pos + k]));
                    _pos += take;
                    remainingChars -= take;
                }
            }

            Skip(4 * runCount + extLength);
            return sb.ToString();
        }
    }

    private static void WalkRecords(byte[] data, int pos, int end, StringBuilder sb)
    {
        while (pos + 8 <= end)
        {
            var verInstance = BitConverter.ToUInt16(data, pos);
            var recType = BitConverter.ToUInt16(data, pos + 2);
            var recLen = BitConverter.ToUInt32(data, pos + 4);
            pos += 8;
            if (recLen > (uint)(end - pos))
                break;
            var len = (int)recLen;

            if ((verInstance & 0x000F) == 0x000F)
            {
                // Container record — recurse into its payload.
                WalkRecords(data, pos, pos + len, sb);
            }
            else if (recType == TextCharsAtom)
            {
                AppendPptText(sb, Encoding.Unicode.GetString(data, pos, len));
            }
            else if (recType == TextBytesAtom)
            {
                var chars = new char[len];
                for (var i = 0; i < len; i++)
                    chars[i] = Cp1252Char(data[pos + i]);
                AppendPptText(sb, new string(chars));
            }

            pos += len;
        }
    }

    private static void AppendPptText(StringBuilder sb, string text)
    {
        // Text atoms separate lines with CR / VT.
        text = text.Replace('\r', '\n').Replace('\v', '\n').Trim();
        if (text.Length > 0)
            sb.AppendLine(text);
    }
}
