using StudyPlatform.API.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class WebClipHtmlConverterTests
{
    // The shape GeeksforGeeks ships inside __NEXT_DATA__: the <code> element wraps the
    // <pre>, the whole widget is bracketed by [GFGTABS] shortcodes, and the markup is
    // pretty-printed so text nodes carry leading indentation.
    private const string GfgCodeWidget = """
        <p>Before starting, install redis.</p>[GFGTABS]<gfg-tabs data-mode="light">
                    <gfg-tab slot="tab">Python</gfg-tab>
        <gfg-panel slot="panel" data-code-lang="python3">
            <code class="language-python3"><div class=highlight><pre><span class=kn>import</span> <span class=nn>redis</span>
        <span class=n>r</span> <span class=o>=</span> <span class=n>redis</span><span class=o>.</span><span class=n>Redis</span><span class=p>(</span><span class=s1>&#39;localhost&#39;</span><span class=p>)</span>
        </pre></div></code>
        </gfg-panel>
        </gfg-tabs>[/GFGTABS]

        <p><strong>Output</strong></p>
        """;

    [Fact]
    public void ConvertHtmlToMarkdown_CodeElementWrappingPre_ProducesOneWellFormedFence()
    {
        var md = WebClipHtmlConverter.ConvertHtmlToMarkdown(GfgCodeWidget);

        Assert.Equal(2, CountFenceLines(md));
        Assert.Contains("```python3\nimport redis", md);
        Assert.DoesNotContain("````", md);
        // Prose after the widget must stay prose, not get swallowed by a dangling fence.
        Assert.Contains("**Output**", md);
    }

    [Fact]
    public void ConvertHtmlToMarkdown_DropsCmsShortcodesAndTabLabels()
    {
        var md = WebClipHtmlConverter.ConvertHtmlToMarkdown(GfgCodeWidget);

        Assert.DoesNotContain("GFGTABS", md);
        Assert.DoesNotContain("Python\n", md);
    }

    [Fact]
    public void ConvertHtmlToMarkdown_StripsSourceIndentationFromProse()
    {
        var html = """
            <div>
                <p>
                        A paragraph indented by the page's own HTML formatting.
                </p>
            </div>
            """;

        var md = WebClipHtmlConverter.ConvertHtmlToMarkdown(html);

        Assert.Equal("A paragraph indented by the page's own HTML formatting.", md);
        Assert.DoesNotContain("```", md);
    }

    [Fact]
    public void ConvertHtmlToMarkdown_KeepsCodeIndentationAndAngleBrackets()
    {
        var html = "<pre><code class=\"language-cpp\">int main() {\n    std::vector&lt;int&gt; v;\n}</code></pre>";

        var md = WebClipHtmlConverter.ConvertHtmlToMarkdown(html);

        Assert.Equal("```cpp\nint main() {\n    std::vector<int> v;\n}\n```", md);
    }

    [Fact]
    public void ConvertHtmlToMarkdown_InlineCodeStaysInline()
    {
        var md = WebClipHtmlConverter.ConvertHtmlToMarkdown("<p>Call <code>r.get()</code> to read.</p>");

        Assert.Equal("Call `r.get()` to read.", md);
    }

    [Fact]
    public void ConvertHtmlToMarkdown_PlainPreBecomesUnlabelledFence()
    {
        var md = WebClipHtmlConverter.ConvertHtmlToMarkdown("<pre>npm install\nnpm run dev</pre>");

        Assert.Equal("```\nnpm install\nnpm run dev\n```", md);
    }

    [Fact]
    public void ConvertHtmlToMarkdown_MultipleCodeBlocksKeepTheirOwnContent()
    {
        var html = "<pre><code class=\"language-py\">print(1)</code></pre><p>then</p>" +
                   "<pre><code class=\"language-js\">console.log(2)</code></pre>";

        var md = WebClipHtmlConverter.ConvertHtmlToMarkdown(html);

        Assert.Equal("```py\nprint(1)\n```\n\nthen\n\n```js\nconsole.log(2)\n```", md);
    }

    [Fact]
    public void ConvertHtmlToMarkdown_BlockquoteIsNotSwallowedByTheBoldRule()
    {
        // "<b" used to match "<blockquote", folding everything up to the next </b> into bold.
        var html = "<blockquote><p><span>r.set('name', 'Alia')</span></p></blockquote>" +
                   "<p><span>This stores a pair.</span></p>" +
                   "<ul><li><b><strong>Key:</strong></b><span> name</span></li></ul>";

        var md = WebClipHtmlConverter.ConvertHtmlToMarkdown(html);

        Assert.Equal("> r.set('name', 'Alia')\n\nThis stores a pair.\n\n- **Key:** name", md);
    }

    [Fact]
    public void ConvertHtmlToMarkdown_ImgIsNotSwallowedByTheItalicRule()
    {
        // Likewise "<i" used to match "<img".
        var html = "<p>Before <img src=\"https://x.test/a.png\" alt=\"a\"> after <i>really</i> done.</p>";

        var md = WebClipHtmlConverter.ConvertHtmlToMarkdown(html);

        Assert.Contains("![a](https://x.test/a.png)", md);
        Assert.Contains("_really_", md);
    }

    [Fact]
    public void ConvertHtmlToMarkdown_KeepsSpacingAroundInlineElements()
    {
        var md = WebClipHtmlConverter.ConvertHtmlToMarkdown(
            "<p>imports the <code><span>redis </span></code><span>Python library</span></p>");

        Assert.Equal("imports the `redis` Python library", md);
    }

    [Fact]
    public void ConvertHtmlToMarkdown_DropsWhitespaceOnlyEmphasis()
    {
        var md = WebClipHtmlConverter.ConvertHtmlToMarkdown(
            "<p><a href=\"https://x.test\"><span>install redis</span><i><em> </em></i></a></p>");

        Assert.Equal("[install redis](https://x.test)", md);
    }

    private static int CountFenceLines(string markdown)
        => markdown.Split('\n').Count(l => l.TrimEnd().StartsWith("```", StringComparison.Ordinal));
}
