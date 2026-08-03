using System.IO.Compression;
using System.Text;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using OpenMcdf;
using StudyPlatform.Application.Services;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class DocumentTextExtractorServiceTests
{
    private readonly Mock<IBlobStorageService> _blob = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly DocumentTextExtractorService _service;

    public DocumentTextExtractorServiceTests()
    {
        _service = new DocumentTextExtractorService(
            _blob.Object, _ai.Object, NullLogger<DocumentTextExtractorService>.Instance);
    }

    private Task<string> ExtractAsync(string fileName, byte[] data, string contentType = "application/octet-stream")
    {
        var blobUrl = $"blob://course/{fileName}";
        _blob.Setup(b => b.DownloadAsync(blobUrl, It.IsAny<CancellationToken>()))
             .ReturnsAsync(new MemoryStream(data));
        return _service.ExtractTextAsync(blobUrl, contentType);
    }

    // ─── Subtitles ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Srt_StripsIndicesAndTimestamps()
    {
        const string srt = "1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n00:00:04,000 --> 00:00:06,000\nSecond <i>line</i>\n";
        var text = await ExtractAsync("lecture.srt", Encoding.UTF8.GetBytes(srt));

        Assert.Contains("Hello world", text);
        Assert.Contains("Second line", text);
        Assert.DoesNotContain("-->", text);
        Assert.DoesNotContain("00:00:01", text);
        Assert.DoesNotContain("<i>", text);
    }

    [Fact]
    public async Task Vtt_StripsHeaderTimingsAndDuplicates()
    {
        const string vtt = "WEBVTT\n\nNOTE this is a comment\n\n00:00.000 --> 00:04.000\n<v Speaker>Hello there\n\n00:04.000 --> 00:08.000\nHello there\n";
        var text = await ExtractAsync("talk.vtt", Encoding.UTF8.GetBytes(vtt));

        Assert.Equal("Hello there", text.Trim());
    }

    // ─── Markup / notebook / rich text ────────────────────────────────────────

    [Fact]
    public async Task Html_StripsMarkupAndScripts()
    {
        const string html = "<html><head><style>p{color:red}</style><script>alert(1)</script></head><body><h1>Title</h1><p>Body &amp; text</p></body></html>";
        var text = await ExtractAsync("page.html", Encoding.UTF8.GetBytes(html));

        Assert.Contains("Title", text);
        Assert.Contains("Body & text", text);
        Assert.DoesNotContain("alert", text);
        Assert.DoesNotContain("color:red", text);
    }

    [Fact]
    public async Task Ipynb_ExtractsMarkdownAndCodeCells()
    {
        const string nb = """
        {"cells":[
          {"cell_type":"markdown","source":["# Heading\n","Some notes"]},
          {"cell_type":"code","source":"print('hi')","outputs":[]}
        ],"nbformat":4}
        """;
        var text = await ExtractAsync("notes.ipynb", Encoding.UTF8.GetBytes(nb));

        Assert.Contains("# Heading", text);
        Assert.Contains("Some notes", text);
        Assert.Contains("print('hi')", text);
    }

    [Fact]
    public async Task Rtf_StripsControlWordsAndTables()
    {
        const string rtf = @"{\rtf1\ansi{\fonttbl{\f0 Arial;}}\f0 Caf\u233?! \b Bold\b0\par Second line}";
        var text = await ExtractAsync("doc.rtf", Encoding.UTF8.GetBytes(rtf));

        Assert.Contains("Café!", text);
        Assert.Contains("Bold", text);
        Assert.Contains("Second line", text);
        Assert.DoesNotContain("Arial", text);
        Assert.DoesNotContain(@"\par", text);
    }

    [Fact]
    public async Task PlainTextFallback_ReturnsRawContent()
    {
        var text = await ExtractAsync("main.py", Encoding.UTF8.GetBytes("def f():\n    return 42\n"));
        Assert.Contains("return 42", text);
    }

    // ─── OpenDocument / iWork ─────────────────────────────────────────────────

    [Fact]
    public async Task Odt_ExtractsParagraphsFromContentXml()
    {
        const string contentXml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                                 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
          <office:body><office:text>
            <text:h>Chapter One</text:h>
            <text:p>First paragraph.</text:p>
          </office:text></office:body>
        </office:document-content>
        """;
        var data = BuildZip(("content.xml", Encoding.UTF8.GetBytes(contentXml)));
        var text = await ExtractAsync("essay.odt", data);

        Assert.Contains("Chapter One", text);
        Assert.Contains("First paragraph.", text);
    }

    [Fact]
    public async Task Pages_LegacyIndexXml_ExtractsText()
    {
        const string indexXml = """<?xml version="1.0"?><doc><section><p>Hello pages</p></section></doc>""";
        var data = BuildZip(("index.xml", Encoding.UTF8.GetBytes(indexXml)));
        var text = await ExtractAsync("essay.pages", data);

        Assert.Contains("Hello pages", text);
    }

    // ─── MOBI ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Mobi_UncompressedText_IsExtracted()
    {
        var text = await ExtractAsync("book.mobi", BuildMobi("Hello <b>book</b>"));
        Assert.Equal("Hello book", text.Trim());
    }

    // ─── Legacy Office (.doc / .ppt) ──────────────────────────────────────────

    [Fact]
    public async Task LegacyDoc_PieceTableText_IsExtracted()
    {
        var text = await ExtractAsync("old.doc", BuildLegacyDoc("Hello"));
        Assert.Contains("Hello", text);
    }

    [Fact]
    public async Task LegacyPpt_TextBytesAtom_IsExtracted()
    {
        var text = await ExtractAsync("old.ppt", BuildLegacyPpt("Slide text"));
        Assert.Contains("Slide text", text);
    }

    // ─── Second-batch subtitle formats ────────────────────────────────────────

    [Fact]
    public async Task Ass_ExtractsDialogueTextWithoutOverrideTags()
    {
        const string ass = "[Script Info]\nTitle: Lecture\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\i1}Hello{\\i0} world\nDialogue: 0,0:00:03.00,0:00:05.00,Default,,0,0,0,,Second\\Nline\n";
        var text = await ExtractAsync("anime.ass", Encoding.UTF8.GetBytes(ass));

        Assert.Contains("Hello world", text);
        Assert.Contains("Second\nline", text);
        Assert.DoesNotContain("Dialogue:", text);
        Assert.DoesNotContain("{\\i1}", text);
    }

    [Fact]
    public async Task Sub_MicroDvd_StripsFrameTimings()
    {
        const string sub = "{10}{50}Hello|world\n{60}{90}Second line\n";
        var text = await ExtractAsync("movie.sub", Encoding.UTF8.GetBytes(sub));

        Assert.Contains("Hello", text);
        Assert.Contains("world", text);
        Assert.Contains("Second line", text);
        Assert.DoesNotContain("{10}", text);
    }

    // ─── XML formats: SVG / FB2 / XPS / Visio ────────────────────────────────

    [Fact]
    public async Task Svg_ExtractsTextElements()
    {
        const string svg = """<svg xmlns="http://www.w3.org/2000/svg"><title>Diagram</title><text>Node A</text><rect width="5"/></svg>""";
        var text = await ExtractAsync("diagram.svg", Encoding.UTF8.GetBytes(svg), "image/svg+xml");

        Assert.Contains("Diagram", text);
        Assert.Contains("Node A", text);
        _ai.Verify(a => a.ExtractTextFromFileAsync(It.IsAny<byte[]>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Fb2_ExtractsTitleAndParagraphs()
    {
        const string fb2 = """
        <FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
          <description><title-info><book-title>My Book</book-title></title-info></description>
          <body><section><p>Chapter text.</p></section></body>
        </FictionBook>
        """;
        var text = await ExtractAsync("book.fb2", Encoding.UTF8.GetBytes(fb2));

        Assert.Contains("My Book", text);
        Assert.Contains("Chapter text.", text);
    }

    [Fact]
    public async Task Xps_ExtractsGlyphUnicodeStrings()
    {
        const string fpage = """<FixedPage xmlns="http://schemas.microsoft.com/xps/2005/06"><Glyphs UnicodeString="XPS text here" /></FixedPage>""";
        var data = BuildZip(("Documents/1/Pages/1.fpage", Encoding.UTF8.GetBytes(fpage)));
        var text = await ExtractAsync("print.xps", data);

        Assert.Contains("XPS text here", text);
    }

    [Fact]
    public async Task Vsdx_ExtractsShapeText()
    {
        const string page = """<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main"><Shapes><Shape><Text>Flow step</Text></Shape></Shapes></PageContents>""";
        var data = BuildZip(("visio/pages/page1.xml", Encoding.UTF8.GetBytes(page)));
        var text = await ExtractAsync("chart.vsdx", data);

        Assert.Contains("Flow step", text);
    }

    // ─── Email formats ────────────────────────────────────────────────────────

    [Fact]
    public async Task Eml_ExtractsHeadersAndBody()
    {
        const string eml = "Subject: Exam notes\r\nFrom: prof@uni.edu\r\nTo: student@uni.edu\r\nContent-Type: text/plain\r\n\r\nStudy chapters 3 and 4.";
        var text = await ExtractAsync("mail.eml", Encoding.UTF8.GetBytes(eml));

        Assert.Contains("Subject: Exam notes", text);
        Assert.Contains("prof@uni.edu", text);
        Assert.Contains("Study chapters 3 and 4.", text);
    }

    [Fact]
    public async Task Mhtml_ExtractsHtmlPart()
    {
        const string mhtml = "MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary=\"BOUND\"\r\n\r\n--BOUND\r\nContent-Type: text/html\r\n\r\n<html><body><p>Archived page body</p></body></html>\r\n--BOUND--\r\n";
        var text = await ExtractAsync("saved.mhtml", Encoding.UTF8.GetBytes(mhtml));

        Assert.Contains("Archived page body", text);
        Assert.DoesNotContain("<p>", text);
    }

    [Fact]
    public async Task Msg_ExtractsMapiSubjectAndBody()
    {
        var data = BuildCompoundFile(
            ("__substg1.0_0037001F", Encoding.Unicode.GetBytes("Meeting notes")),
            ("__substg1.0_1000001F", Encoding.Unicode.GetBytes("Agenda: review thesis draft")));
        var text = await ExtractAsync("mail.msg", data);

        Assert.Contains("Subject: Meeting notes", text);
        Assert.Contains("Agenda: review thesis draft", text);
    }

    // ─── Macro-enabled OpenXML / legacy Excel ─────────────────────────────────

    [Fact]
    public async Task Docm_UsesDocxExtractor()
    {
        var text = await ExtractAsync("notes.docm", BuildDocx("Macro doc body"));
        Assert.Contains("Macro doc body", text);
    }

    [Fact]
    public async Task LegacyXls_SstStrings_AreExtracted()
    {
        var sst = new List<byte>();
        sst.AddRange(BitConverter.GetBytes(2));  // cstTotal
        sst.AddRange(BitConverter.GetBytes(2));  // cstUnique
        // "Alpha" — compressed 8-bit string
        sst.AddRange(BitConverter.GetBytes((ushort)5));
        sst.Add(0x00);
        sst.AddRange(Encoding.ASCII.GetBytes("Alpha"));
        // "Béta" — UTF-16 string
        sst.AddRange(BitConverter.GetBytes((ushort)4));
        sst.Add(0x01);
        sst.AddRange(Encoding.Unicode.GetBytes("Béta"));

        var workbook = BiffRecord(0x00FC, sst.ToArray());
        var text = await ExtractAsync("grades.xls", BuildCompoundFile(("Workbook", workbook)));

        Assert.Contains("Alpha", text);
        Assert.Contains("Béta", text);
    }

    [Fact]
    public async Task LegacyXls_StringSpanningContinueRecord_IsReassembled()
    {
        var sst = new List<byte>();
        sst.AddRange(BitConverter.GetBytes(1));  // cstTotal
        sst.AddRange(BitConverter.GetBytes(1));  // cstUnique
        sst.AddRange(BitConverter.GetBytes((ushort)10)); // cch = 10, only 5 chars here
        sst.Add(0x00);
        sst.AddRange(Encoding.ASCII.GetBytes("Hello"));

        var continued = new List<byte> { 0x00 };  // restated high-byte flag
        continued.AddRange(Encoding.ASCII.GetBytes("World"));

        var workbook = BiffRecord(0x00FC, sst.ToArray())
            .Concat(BiffRecord(0x003C, continued.ToArray()))
            .ToArray();
        var text = await ExtractAsync("big.xls", BuildCompoundFile(("Workbook", workbook)));

        Assert.Contains("HelloWorld", text);
    }

    // ─── Third-batch formats ──────────────────────────────────────────────────

    [Fact]
    public async Task FlatOdf_ExtractsParagraphsWithoutZipWrapper()
    {
        const string fodt = """
        <?xml version="1.0" encoding="UTF-8"?>
        <office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                         xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
          <office:body><office:text>
            <text:h>Flat heading</text:h>
            <text:p>Flat paragraph.</text:p>
          </office:text></office:body>
        </office:document>
        """;
        var text = await ExtractAsync("notes.fodt", Encoding.UTF8.GetBytes(fodt));

        Assert.Contains("Flat heading", text);
        Assert.Contains("Flat paragraph.", text);
    }

    [Fact]
    public async Task StarOfficeAndOdfTemplates_UseTheOpenDocumentExtractor()
    {
        const string contentXml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                                 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
          <office:body><office:text><text:p>Template body</text:p></office:text></office:body>
        </office:document-content>
        """;
        var data = BuildZip(("content.xml", Encoding.UTF8.GetBytes(contentXml)));

        Assert.Contains("Template body", await ExtractAsync("template.ott", data));
        Assert.Contains("Template body", await ExtractAsync("legacy.sxw", data));
        Assert.Contains("Template body", await ExtractAsync("diagram.odg", data));
    }

    [Fact]
    public async Task AbiWord_ExtractsParagraphs()
    {
        const string abw = """
        <?xml version="1.0" encoding="UTF-8"?>
        <abiword xmlns="http://www.abisource.com/awml.dtd">
          <section><p>First line.</p><p>Second line.</p></section>
        </abiword>
        """;
        var text = await ExtractAsync("essay.abw", Encoding.UTF8.GetBytes(abw));

        Assert.Contains("First line.", text);
        Assert.Contains("Second line.", text);
    }

    [Fact]
    public async Task Ttml_ExtractsCueTextAndLineBreaks()
    {
        const string ttml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <tt xmlns="http://www.w3.org/ns/ttml">
          <body><div>
            <p begin="00:00:01" end="00:00:04">Hello <span>there</span></p>
            <p begin="00:00:04" end="00:00:08">Second<br/>line</p>
          </div></body>
        </tt>
        """;
        var text = await ExtractAsync("captions.ttml", Encoding.UTF8.GetBytes(ttml));

        Assert.Contains("Hello there", text);
        Assert.Contains("Second\nline", text);
        Assert.DoesNotContain("00:00:01", text);
    }

    [Fact]
    public async Task Sbv_StripsCommaSeparatedTimings()
    {
        const string sbv = "0:00:01.000,0:00:04.000\nFirst caption\n\n0:00:04.000,0:00:08.000\nSecond caption\n";
        var text = await ExtractAsync("talk.sbv", Encoding.UTF8.GetBytes(sbv));

        Assert.Contains("First caption", text);
        Assert.Contains("Second caption", text);
        Assert.DoesNotContain("0:00:01", text);
    }

    [Fact]
    public async Task Lrc_StripsTimestampsAndMetadataLines()
    {
        const string lrc = "[ar:Artist]\n[ti:Title]\n[00:12.34]First lyric\n[00:15.00][00:30.00]Repeated lyric\n";
        var text = await ExtractAsync("song.lrc", Encoding.UTF8.GetBytes(lrc));

        Assert.Equal("First lyric\nRepeated lyric", text.Trim().ReplaceLineEndings("\n"));
    }

    [Fact]
    public async Task Azw3_UsesTheMobiExtractor()
    {
        var text = await ExtractAsync("book.azw3", BuildMobi("Kindle <i>text</i>"));
        Assert.Equal("Kindle text", text.Trim());
    }

    [Fact]
    public async Task PalmDocPdb_IsExtracted()
    {
        var text = await ExtractAsync("reader.pdb", BuildMobi("Palm reader text", palmType: "TEXtREAd"));
        Assert.Equal("Palm reader text", text.Trim());
    }

    [Fact]
    public async Task Dotm_UsesDocxExtractor()
    {
        var text = await ExtractAsync("macro.dotm", BuildDocx("Template paragraph"));
        Assert.Contains("Template paragraph", text);
    }

    // ─── AI OCR routing ───────────────────────────────────────────────────────

    [Fact]
    public async Task Image_RoutesToAiOcr()
    {
        var bytes = new byte[] { 1, 2, 3 };
        _ai.Setup(a => a.ExtractTextFromFileAsync(bytes, "image/png", It.IsAny<CancellationToken>()))
           .ReturnsAsync("ocr result");

        var text = await ExtractAsync("scan.png", bytes, "image/png");

        Assert.Equal("ocr result", text);
    }

    [Fact]
    public async Task Image_WhenAiUnavailable_ReturnsEmpty()
    {
        _ai.Setup(a => a.ExtractTextFromFileAsync(It.IsAny<byte[]>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
           .ThrowsAsync(new InvalidOperationException("no api key"));

        var text = await ExtractAsync("scan.jpg", [1, 2, 3], "image/jpeg");

        Assert.Equal(string.Empty, text);
    }

    [Fact]
    public async Task Jfif_IsSentToOcrAsJpeg()
    {
        var bytes = new byte[] { 1, 2, 3 };
        _ai.Setup(a => a.ExtractTextFromFileAsync(bytes, "image/jpeg", It.IsAny<CancellationToken>()))
           .ReturnsAsync("ocr result");

        var text = await ExtractAsync("scan.jfif", bytes);

        Assert.Equal("ocr result", text);
    }

    // ─── BMP transcoding (no provider accepts inline BMP) ─────────────────────

    [Fact]
    public async Task Bmp_IsTranscodedToPngBeforeOcr()
    {
        byte[]? sent = null;
        _ai.Setup(a => a.ExtractTextFromFileAsync(It.IsAny<byte[]>(), "image/png", It.IsAny<CancellationToken>()))
           .Callback<byte[], string, CancellationToken>((d, _, _) => sent = d)
           .ReturnsAsync("ocr result");

        // 2x2, bottom-up: stored bottom row first (red, green), then (blue, white).
        var bmp = BuildBmp24(2, 2, [
            [0x00, 0x00, 0xFF], [0x00, 0xFF, 0x00],
            [0xFF, 0x00, 0x00], [0xFF, 0xFF, 0xFF],
        ]);

        var text = await ExtractAsync("scan.bmp", bmp, "image/bmp");

        Assert.Equal("ocr result", text);
        Assert.NotNull(sent);

        var chunks = ReadPngChunks(sent!);
        var ihdr = chunks["IHDR"];
        Assert.Equal(2, ReadInt32BE(ihdr, 0));
        Assert.Equal(2, ReadInt32BE(ihdr, 4));
        Assert.Equal(8, ihdr[8]);   // bit depth
        Assert.Equal(2, ihdr[9]);   // colour type: RGB, alpha dropped for 24-bit
        Assert.True(chunks.ContainsKey("IEND"));

        // PNG rows are top-down, so the BMP's last stored row comes out first.
        Assert.Equal(
            new byte[]
            {
                0, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF,
                0, 0xFF, 0x00, 0x00, 0x00, 0xFF, 0x00,
            },
            Inflate(chunks["IDAT"]));
    }

    [Fact]
    public async Task Bmp_PaletteIndexed_IsTranscoded()
    {
        byte[]? sent = null;
        _ai.Setup(a => a.ExtractTextFromFileAsync(It.IsAny<byte[]>(), "image/png", It.IsAny<CancellationToken>()))
           .Callback<byte[], string, CancellationToken>((d, _, _) => sent = d)
           .ReturnsAsync("ocr");

        await ExtractAsync("scan.dib", BuildBmp8Palette());

        Assert.NotNull(sent);
        // Single top-down row: palette index 1 (red) then index 0 (black).
        Assert.Equal(
            new byte[] { 0, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00 },
            Inflate(ReadPngChunks(sent!)["IDAT"]));
    }

    [Fact]
    public async Task Bmp_UnsupportedCompression_ReturnsEmptyWithoutCallingAi()
    {
        var bmp = BuildBmp24(1, 1, [[1, 2, 3]]);
        bmp[FileHeaderSize + 16] = 1; // BI_RLE8

        var text = await ExtractAsync("scan.bmp", bmp, "image/bmp");

        Assert.Equal(string.Empty, text);
        _ai.Verify(a => a.ExtractTextFromFileAsync(It.IsAny<byte[]>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Test file builders ───────────────────────────────────────────────────

    private const int FileHeaderSize = 14;

    // Uncompressed 24-bit BMP; pixels are BGR triples in stored (bottom-up) order.
    private static byte[] BuildBmp24(int width, int height, byte[][] pixels)
    {
        var stride = ((width * 24 + 31) / 32) * 4;
        var pixelOffset = FileHeaderSize + 40;
        var data = new byte[pixelOffset + stride * height];

        data[0] = (byte)'B'; data[1] = (byte)'M';
        BitConverter.GetBytes(data.Length).CopyTo(data, 2);
        BitConverter.GetBytes(pixelOffset).CopyTo(data, 10);

        BitConverter.GetBytes(40).CopyTo(data, FileHeaderSize);
        BitConverter.GetBytes(width).CopyTo(data, FileHeaderSize + 4);
        BitConverter.GetBytes(height).CopyTo(data, FileHeaderSize + 8);
        BitConverter.GetBytes((ushort)1).CopyTo(data, FileHeaderSize + 12);
        BitConverter.GetBytes((ushort)24).CopyTo(data, FileHeaderSize + 14);

        for (var y = 0; y < height; y++)
            for (var x = 0; x < width; x++)
                pixels[y * width + x].CopyTo(data, pixelOffset + y * stride + x * 3);

        return data;
    }

    // 2x1, 8-bit indexed, palette [black, red].
    private static byte[] BuildBmp8Palette()
    {
        const int paletteEntries = 2;
        var pixelOffset = FileHeaderSize + 40 + paletteEntries * 4;
        var data = new byte[pixelOffset + 4];

        data[0] = (byte)'B'; data[1] = (byte)'M';
        BitConverter.GetBytes(data.Length).CopyTo(data, 2);
        BitConverter.GetBytes(pixelOffset).CopyTo(data, 10);

        BitConverter.GetBytes(40).CopyTo(data, FileHeaderSize);
        BitConverter.GetBytes(2).CopyTo(data, FileHeaderSize + 4);
        BitConverter.GetBytes(1).CopyTo(data, FileHeaderSize + 8);
        BitConverter.GetBytes((ushort)1).CopyTo(data, FileHeaderSize + 12);
        BitConverter.GetBytes((ushort)8).CopyTo(data, FileHeaderSize + 14);
        BitConverter.GetBytes(paletteEntries).CopyTo(data, FileHeaderSize + 32);

        var palette = FileHeaderSize + 40;
        data[palette + 4] = 0x00;  // entry 1: B
        data[palette + 5] = 0x00;  // G
        data[palette + 6] = 0xFF;  // R

        data[pixelOffset] = 1;
        data[pixelOffset + 1] = 0;
        return data;
    }

    private static Dictionary<string, byte[]> ReadPngChunks(byte[] png)
    {
        Assert.Equal(new byte[] { 0x89, (byte)'P', (byte)'N', (byte)'G', 0x0D, 0x0A, 0x1A, 0x0A }, png[..8]);

        var chunks = new Dictionary<string, byte[]>();
        var pos = 8;
        while (pos + 12 <= png.Length)
        {
            var length = ReadInt32BE(png, pos);
            var type = Encoding.ASCII.GetString(png, pos + 4, 4);
            chunks[type] = png[(pos + 8)..(pos + 8 + length)];
            pos += 12 + length;
        }
        return chunks;
    }

    private static byte[] Inflate(byte[] zlib)
    {
        using var input = new MemoryStream(zlib);
        using var inflater = new ZLibStream(input, CompressionMode.Decompress);
        using var output = new MemoryStream();
        inflater.CopyTo(output);
        return output.ToArray();
    }

    private static int ReadInt32BE(byte[] data, int offset) =>
        (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];

    private static byte[] BuildZip(params (string Name, byte[] Content)[] entries)
    {
        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var (name, content) in entries)
            {
                using var entryStream = zip.CreateEntry(name).Open();
                entryStream.Write(content);
            }
        }
        return ms.ToArray();
    }

    // Minimal PDB/MOBI container: header, two records (PalmDOC header + one
    // uncompressed text record).
    private static byte[] BuildMobi(string bookHtml, string palmType = "BOOKMOBI")
    {
        var textBytes = Encoding.UTF8.GetBytes(bookHtml);
        var data = new byte[94 + 16 + textBytes.Length];

        Encoding.ASCII.GetBytes(palmType).CopyTo(data, 60);
        WriteUInt16BE(data, 76, 2);            // record count
        WriteUInt32BE(data, 78, 94);           // record 0 offset
        WriteUInt32BE(data, 86, 94 + 16);      // record 1 offset

        WriteUInt16BE(data, 94, 1);                          // compression: none
        WriteUInt32BE(data, 94 + 4, (uint)textBytes.Length); // text length
        WriteUInt16BE(data, 94 + 8, 1);                      // text record count
        WriteUInt16BE(data, 94 + 10, 4096);                  // record size
        WriteUInt16BE(data, 94 + 12, 0);                     // no encryption

        textBytes.CopyTo(data, 94 + 16);
        return data;
    }

    // Minimal [MS-DOC] file: FIB with a CLX in the 0Table stream describing one
    // compressed (8-bit) text piece.
    private static byte[] BuildLegacyDoc(string docText)
    {
        var textBytes = Encoding.ASCII.GetBytes(docText);
        var wd = new byte[512 + textBytes.Length];
        wd[0] = 0xEC; wd[1] = 0xA5;                        // wIdent
        // flags at 0x0A left 0 → table stream is "0Table"
        BitConverter.GetBytes(0).CopyTo(wd, 0x01A2);       // fcClx = 0
        textBytes.CopyTo(wd, 512);

        // Pcdt: 0x02, lcbPlcPcd, then PlcPcd with one piece
        var table = new byte[5 + 8 + 8];
        table[0] = 0x02;
        BitConverter.GetBytes(16).CopyTo(table, 1);                    // lcbPlcPcd: 2 CPs + 1 PCD
        BitConverter.GetBytes(0).CopyTo(table, 5);                     // cp start
        BitConverter.GetBytes(textBytes.Length).CopyTo(table, 9);      // cp end
        // PCD: 2 flag bytes, then fc with bit 30 set (compressed, fc/2 = 512)
        BitConverter.GetBytes(0x40000000u | 1024u).CopyTo(table, 15);
        BitConverter.GetBytes(table.Length).CopyTo(wd, 0x01A6);        // lcbClx

        return BuildCompoundFile(("WordDocument", wd), ("0Table", table));
    }

    // Minimal [MS-PPT] stream: a single TextBytesAtom record.
    private static byte[] BuildLegacyPpt(string slideText)
    {
        var textBytes = Encoding.ASCII.GetBytes(slideText);
        var ppt = new byte[8 + textBytes.Length];
        BitConverter.GetBytes((ushort)0x0FA8).CopyTo(ppt, 2);      // TextBytesAtom
        BitConverter.GetBytes((uint)textBytes.Length).CopyTo(ppt, 4);
        textBytes.CopyTo(ppt, 8);

        return BuildCompoundFile(("PowerPoint Document", ppt));
    }

    private static byte[] BuildDocx(string paragraphText)
    {
        using var ms = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document))
        {
            var main = doc.AddMainDocumentPart();
            main.Document = new Document(new Body(new Paragraph(new Run(new Text(paragraphText)))));
        }
        return ms.ToArray();
    }

    private static byte[] BiffRecord(ushort type, byte[] payload)
    {
        var record = new byte[4 + payload.Length];
        BitConverter.GetBytes(type).CopyTo(record, 0);
        BitConverter.GetBytes((ushort)payload.Length).CopyTo(record, 2);
        payload.CopyTo(record, 4);
        return record;
    }

    private static byte[] BuildCompoundFile(params (string Name, byte[] Content)[] streams)
    {
        using var ms = new MemoryStream();
        using (var root = RootStorage.Create(ms))
        {
            foreach (var (name, content) in streams)
            {
                using var stream = root.CreateStream(name);
                stream.Write(content);
            }
        }
        return ms.ToArray();
    }

    private static void WriteUInt16BE(byte[] data, int offset, ushort value)
    {
        data[offset] = (byte)(value >> 8);
        data[offset + 1] = (byte)value;
    }

    private static void WriteUInt32BE(byte[] data, int offset, uint value)
    {
        data[offset] = (byte)(value >> 24);
        data[offset + 1] = (byte)(value >> 16);
        data[offset + 2] = (byte)(value >> 8);
        data[offset + 3] = (byte)value;
    }
}
