using System.Text;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Extracts the raw (HTML) book text from a MOBI/PalmDOC file — the container
/// behind .mobi, .azw, .azw3 and .prc, plus the plain PalmDOC .pdb reader
/// format. Supports uncompressed and PalmDOC-compressed text records; HUFF/CDIC
/// compression and DRM-encrypted books are not supported and yield an empty
/// string.
/// </summary>
internal static class MobiTextExtractor
{
    private const int PalmDocCompression = 2;
    private const int HuffCdicCompression = 17480;

    public static string ExtractRawText(byte[] data)
    {
        if (data.Length < 86)
            return string.Empty;

        // Palm database type+creator at offset 60: "BOOKMOBI" for MOBI/AZW,
        // "TEXtREAd" for plain PalmDOC readers. Both carry the same record-0
        // PalmDOC header, so only the default text encoding differs.
        var palmType = Encoding.ASCII.GetString(data, 60, 8);
        var isPalmDocReader = palmType == "TEXtREAd";
        if (palmType != "BOOKMOBI" && !isPalmDocReader)
            return string.Empty;

        int numRecords = ReadUInt16BE(data, 76);
        if (numRecords < 2 || 78 + 8 * numRecords > data.Length)
            return string.Empty;

        var offsets = new int[numRecords + 1];
        for (var i = 0; i < numRecords; i++)
            offsets[i] = (int)ReadUInt32BE(data, 78 + 8 * i);
        offsets[numRecords] = data.Length;

        var rec0 = offsets[0];
        if (rec0 + 16 > data.Length)
            return string.Empty;

        int compression = ReadUInt16BE(data, rec0);
        int textRecordCount = ReadUInt16BE(data, rec0 + 8);
        int encryption = ReadUInt16BE(data, rec0 + 12);
        if (encryption != 0 || compression == HuffCdicCompression)
            return string.Empty; // DRM / HUFF-CDIC not supported

        // PalmDOC readers predate the MOBI header and its encoding field; their
        // text is cp1252 by convention.
        var textEncoding = isPalmDocReader ? 1252 : 65001;
        var extraFlags = 0;
        if (rec0 + 24 <= data.Length && Encoding.ASCII.GetString(data, rec0 + 16, 4) == "MOBI")
        {
            var mobiHeaderLen = (int)ReadUInt32BE(data, rec0 + 20);
            textEncoding = (int)ReadUInt32BE(data, rec0 + 28);
            // Extra-data flags live at record offset 0xF2 in newer headers.
            if (mobiHeaderLen >= 0xE4 && rec0 + 0xF4 <= data.Length)
                extraFlags = ReadUInt16BE(data, rec0 + 0xF2);
        }

        var text = new List<byte>();
        for (var r = 1; r <= textRecordCount && r < numRecords; r++)
        {
            var start = offsets[r];
            var size = TrimTrailingEntries(data, start, offsets[r + 1] - start, extraFlags);
            if (size <= 0 || start + size > data.Length)
                continue;

            if (compression == PalmDocCompression)
                DecompressPalmDoc(data, start, size, text);
            else
                for (var i = 0; i < size; i++)
                    text.Add(data[start + i]);
        }

        var bytes = text.ToArray();
        return textEncoding == 1252 ? Encoding.Latin1.GetString(bytes) : Encoding.UTF8.GetString(bytes);
    }

    // Each text record can carry trailing entries (indexing data, multibyte
    // overlaps) described by the extra-data flags; they are not book text.
    private static int TrimTrailingEntries(byte[] data, int start, int size, int extraFlags)
    {
        for (var flags = extraFlags >> 1; flags != 0 && size > 0; flags >>= 1)
        {
            if ((flags & 1) != 0)
                size -= GetTrailingEntrySize(data, start, size);
        }

        if ((extraFlags & 1) != 0 && size > 0)
            size -= (data[start + size - 1] & 0x3) + 1;

        return size;
    }

    // Trailing entry sizes are backward-encoded variable-width integers.
    private static int GetTrailingEntrySize(byte[] data, int start, int size)
    {
        var value = 0;
        for (var i = Math.Max(0, size - 4); i < size; i++)
        {
            var b = data[start + i];
            if ((b & 0x80) != 0) value = 0;
            value = (value << 7) | (b & 0x7F);
        }
        return value;
    }

    private static void DecompressPalmDoc(byte[] data, int offset, int len, List<byte> output)
    {
        var i = 0;
        while (i < len)
        {
            int b = data[offset + i++];
            if (b == 0x00)
            {
                output.Add(0);
            }
            else if (b <= 0x08)
            {
                for (var k = 0; k < b && i < len; k++)
                    output.Add(data[offset + i++]);
            }
            else if (b <= 0x7F)
            {
                output.Add((byte)b);
            }
            else if (b <= 0xBF)
            {
                if (i >= len) break;
                var pair = (b << 8) | data[offset + i++];
                var distance = (pair >> 3) & 0x7FF;
                var count = (pair & 7) + 3;
                for (var k = 0; k < count; k++)
                {
                    var src = output.Count - distance;
                    output.Add(src >= 0 ? output[src] : (byte)' ');
                }
            }
            else
            {
                output.Add((byte)' ');
                output.Add((byte)(b ^ 0x80));
            }
        }
    }

    private static ushort ReadUInt16BE(byte[] data, int offset) =>
        (ushort)((data[offset] << 8) | data[offset + 1]);

    private static uint ReadUInt32BE(byte[] data, int offset) =>
        ((uint)data[offset] << 24) | ((uint)data[offset + 1] << 16) |
        ((uint)data[offset + 2] << 8) | data[offset + 3];
}
