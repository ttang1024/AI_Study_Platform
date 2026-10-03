using System.Buffers.Binary;
using System.IO.Compression;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Transcodes a Windows bitmap (.bmp/.dib) to PNG so it can be sent to an AI
/// provider for OCR — none of them accept inline BMP. Covers the uncompressed
/// (BI_RGB) 24/32-bit and 1/4/8-bit palette forms that scanners and screenshot
/// tools produce; anything else (RLE, JPEG/PNG-in-BMP, 16-bit, OS/2 headers)
/// returns null so the caller can degrade instead of shipping garbage.
/// </summary>
internal static class BmpToPngConverter
{
    private const int FileHeaderSize = 14;
    private const int BiRgb = 0;
    private const int BiBitfields = 3;

    public static byte[]? Convert(byte[] bmp)
    {
        if (bmp.Length < FileHeaderSize + 40 || bmp[0] != 'B' || bmp[1] != 'M')
            return null;

        var pixelOffset = ReadInt32(bmp, 10);
        var headerSize = ReadInt32(bmp, FileHeaderSize);
        // BITMAPINFOHEADER or later; the OS/2 12-byte header is not supported.
        if (headerSize < 40)
            return null;

        var width = ReadInt32(bmp, FileHeaderSize + 4);
        var height = ReadInt32(bmp, FileHeaderSize + 8);
        int bitsPerPixel = ReadUInt16(bmp, FileHeaderSize + 14);
        var compression = ReadInt32(bmp, FileHeaderSize + 16);
        var paletteColors = ReadInt32(bmp, FileHeaderSize + 32);

        // A negative height means the rows are stored top-down.
        var topDown = height < 0;
        height = Math.Abs(height);

        if (width <= 0 || height <= 0 || (long)width * height > 64_000_000)
            return null;
        if (compression != BiRgb && !(compression == BiBitfields && bitsPerPixel == 32))
            return null;
        if (bitsPerPixel is not (1 or 4 or 8 or 24 or 32))
            return null;
        if (pixelOffset < FileHeaderSize + headerSize || pixelOffset > bmp.Length)
            return null;

        var palette = ReadPalette(bmp, headerSize, bitsPerPixel, paletteColors);
        if (bitsPerPixel <= 8 && palette == null)
            return null;

        // BMP rows are padded to a 4-byte boundary.
        var strideBits = (long)width * bitsPerPixel;
        var stride = (int)(((strideBits + 31) / 32) * 4);
        if ((long)pixelOffset + (long)stride * height > bmp.Length)
            return null;

        // 32-bit BI_RGB leaves the fourth byte undefined, and most writers leave
        // it zero — taking that as alpha would hand the model a blank image.
        // Only keep an alpha channel when the file actually populates one.
        var hasAlpha = bitsPerPixel == 32 && HasNonZeroAlpha(bmp, pixelOffset, stride, width, height);
        var samplesPerPixel = hasAlpha ? 4 : 3;

        // One filter byte (0 = None) then RGB(A) samples, per PNG scanline.
        var rawLength = (long)height * (1 + (long)width * samplesPerPixel);
        if (rawLength > int.MaxValue)
            return null;

        var raw = new byte[rawLength];
        var outPos = 0;
        for (var y = 0; y < height; y++)
        {
            // PNG is always top-down; bottom-up BMP rows are read in reverse.
            var sourceRow = topDown ? y : height - 1 - y;
            var rowStart = pixelOffset + sourceRow * stride;

            raw[outPos++] = 0;
            for (var x = 0; x < width; x++)
            {
                var (b, g, r, a) = ReadPixel(bmp, rowStart, x, bitsPerPixel, palette);
                raw[outPos++] = r;
                raw[outPos++] = g;
                raw[outPos++] = b;
                if (hasAlpha)
                    raw[outPos++] = a;
            }
        }

        return WritePng(width, height, hasAlpha, raw);
    }

    private static (byte B, byte G, byte R, byte A) ReadPixel(
        byte[] bmp, int rowStart, int x, int bitsPerPixel, byte[]? palette)
    {
        switch (bitsPerPixel)
        {
            case 32:
            {
                var p = rowStart + x * 4;
                return (bmp[p], bmp[p + 1], bmp[p + 2], bmp[p + 3]);
            }
            case 24:
            {
                var p = rowStart + x * 3;
                return (bmp[p], bmp[p + 1], bmp[p + 2], 255);
            }
            default:
            {
                var index = ReadPaletteIndex(bmp, rowStart, x, bitsPerPixel);
                var entry = index * 4;
                if (palette == null || entry + 2 >= palette.Length)
                    return (0, 0, 0, 255);
                return (palette[entry], palette[entry + 1], palette[entry + 2], 255);
            }
        }
    }

    private static bool HasNonZeroAlpha(byte[] bmp, int pixelOffset, int stride, int width, int height)
    {
        for (var y = 0; y < height; y++)
        {
            var rowStart = pixelOffset + y * stride;
            for (var x = 0; x < width; x++)
            {
                if (bmp[rowStart + x * 4 + 3] != 0)
                    return true;
            }
        }
        return false;
    }

    private static int ReadPaletteIndex(byte[] bmp, int rowStart, int x, int bitsPerPixel) => bitsPerPixel switch
    {
        8 => bmp[rowStart + x],
        4 => (bmp[rowStart + x / 2] >> (x % 2 == 0 ? 4 : 0)) & 0x0F,
        _ => (bmp[rowStart + x / 8] >> (7 - x % 8)) & 0x01,
    };

    private static byte[]? ReadPalette(byte[] bmp, int headerSize, int bitsPerPixel, int paletteColors)
    {
        if (bitsPerPixel > 8)
            return null;

        var count = paletteColors > 0 ? paletteColors : 1 << bitsPerPixel;
        var start = FileHeaderSize + headerSize;
        var length = count * 4;
        if (start + length > bmp.Length)
            return null;

        var palette = new byte[length];
        Array.Copy(bmp, start, palette, 0, length);
        return palette;
    }

    // ── Minimal PNG writer (IHDR / IDAT / IEND, no interlacing) ───────────

    private static byte[] WritePng(int width, int height, bool hasAlpha, byte[] raw)
    {
        using var output = new MemoryStream();
        output.Write([0x89, (byte)'P', (byte)'N', (byte)'G', 0x0D, 0x0A, 0x1A, 0x0A]);

        var ihdr = new byte[13];
        BinaryPrimitives.WriteInt32BigEndian(ihdr.AsSpan(0), width);
        BinaryPrimitives.WriteInt32BigEndian(ihdr.AsSpan(4), height);
        ihdr[8] = 8;                          // bit depth
        ihdr[9] = (byte)(hasAlpha ? 6 : 2);   // colour type: RGBA / RGB
        WriteChunk(output, "IHDR", ihdr);

        // PNG's IDAT payload is a zlib stream, which is exactly what ZLibStream emits.
        using var compressed = new MemoryStream();
        using (var deflate = new ZLibStream(compressed, CompressionLevel.Optimal, leaveOpen: true))
            deflate.Write(raw, 0, raw.Length);
        WriteChunk(output, "IDAT", compressed.ToArray());

        WriteChunk(output, "IEND", []);
        return output.ToArray();
    }

    private static void WriteChunk(Stream stream, string type, byte[] payload)
    {
        Span<byte> length = stackalloc byte[4];
        BinaryPrimitives.WriteInt32BigEndian(length, payload.Length);
        stream.Write(length);

        var typeBytes = new[] { (byte)type[0], (byte)type[1], (byte)type[2], (byte)type[3] };
        stream.Write(typeBytes);
        stream.Write(payload);

        var crc = Crc32(typeBytes, payload);
        Span<byte> crcBytes = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(crcBytes, crc);
        stream.Write(crcBytes);
    }

    private static readonly uint[] CrcTable = BuildCrcTable();

    private static uint[] BuildCrcTable()
    {
        var table = new uint[256];
        for (uint n = 0; n < 256; n++)
        {
            var c = n;
            for (var k = 0; k < 8; k++)
                c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            table[n] = c;
        }
        return table;
    }

    private static uint Crc32(byte[] type, byte[] payload)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in type)
            crc = CrcTable[(crc ^ b) & 0xFF] ^ (crc >> 8);
        foreach (var b in payload)
            crc = CrcTable[(crc ^ b) & 0xFF] ^ (crc >> 8);
        return crc ^ 0xFFFFFFFFu;
    }

    private static int ReadInt32(byte[] data, int offset) =>
        BinaryPrimitives.ReadInt32LittleEndian(data.AsSpan(offset, 4));

    private static ushort ReadUInt16(byte[] data, int offset) =>
        BinaryPrimitives.ReadUInt16LittleEndian(data.AsSpan(offset, 2));
}
