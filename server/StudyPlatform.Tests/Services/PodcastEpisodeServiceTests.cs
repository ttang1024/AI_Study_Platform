using System.Net;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class PodcastEpisodeServiceTests
{
    private const string SampleRss = """
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
          <channel>
            <title>Test Show</title>
            <itunes:image href="https://cdn.example.com/show.jpg"/>
            <item>
              <title>Episode One</title>
              <guid>ep-1</guid>
              <link>https://example.com/episodes/1</link>
              <description>&lt;p&gt;First &amp;amp; best&lt;/p&gt;</description>
              <pubDate>Tue, 30 Jun 2026 08:00:00 GMT</pubDate>
              <itunes:duration>1:02:03</itunes:duration>
              <enclosure url="https://cdn.example.com/ep1.mp3" type="audio/mpeg" length="1000"/>
            </item>
            <item>
              <title>No Audio Here</title>
              <guid>ep-2</guid>
            </item>
            <item>
              <title>Episode Three</title>
              <guid>ep-3</guid>
              <itunes:duration>1830</itunes:duration>
              <enclosure url="https://cdn.example.com/ep3.mp3" type="audio/mpeg"/>
            </item>
          </channel>
        </rss>
        """;

    private static PodcastEpisodeService CreateService(string body, string contentType = "application/xml")
    {
        var handler = new StubHandler(body, contentType);
        return new PodcastEpisodeService(new HttpClient(handler));
    }

    [Fact]
    public async Task GetFeedAsync_ParsesRssChannelAndEpisodes()
    {
        var service = CreateService(SampleRss);

        var feed = await service.GetFeedAsync("https://example.com/feed.xml");

        Assert.NotNull(feed);
        Assert.Equal("Test Show", feed!.Title);
        Assert.Equal("https://cdn.example.com/show.jpg", feed.ThumbnailUrl);
        // The enclosure-less item is skipped.
        Assert.Equal(2, feed.Episodes.Count);

        var ep1 = feed.Episodes[0];
        Assert.Equal("ep-1", ep1.Id);
        Assert.Equal("Episode One", ep1.Title);
        Assert.Equal("https://cdn.example.com/ep1.mp3", ep1.AudioUrl);
        Assert.Equal("https://example.com/episodes/1", ep1.Link);
        Assert.Equal("First & best", ep1.Description); // HTML stripped and decoded
        Assert.Equal((1 * 3600 + 2 * 60 + 3) * 1000, ep1.DurationMs); // clock format
        Assert.Equal(new DateTime(2026, 6, 30, 8, 0, 0), ep1.PublishedAt);

        Assert.Equal(1830 * 1000, feed.Episodes[1].DurationMs); // plain-seconds format
    }

    [Fact]
    public async Task GetEpisodeInfoAsync_OnRssFeed_ReturnsNullInsteadOfGrabbingFirstEnclosure()
    {
        var service = CreateService(SampleRss);

        var info = await service.GetEpisodeInfoAsync("https://example.com/feed.xml");

        Assert.Null(info);
    }

    [Fact]
    public async Task GetEpisodeInfoAsync_DirectAudioUrl_PassesThrough()
    {
        var service = CreateService("");

        var info = await service.GetEpisodeInfoAsync("https://cdn.example.com/shows/deep_learning-101.mp3");

        Assert.NotNull(info);
        Assert.Equal("https://cdn.example.com/shows/deep_learning-101.mp3", info!.AudioUrl);
        Assert.Equal("deep learning 101", info.Title);
    }

    [Fact]
    public async Task GetEpisodeInfoAsync_EpisodePage_ExtractsOgAudioAndMetadata()
    {
        var html = """
            <html><head>
            <title>fallback</title>
            <meta property="og:title" content="Great Episode"/>
            <meta property="og:site_name" content="Great Show"/>
            <meta property="og:image" content="https://cdn.example.com/art.jpg"/>
            <meta property="og:audio" content="https://cdn.example.com/audio/great.mp3"/>
            </head><body></body></html>
            """;
        var service = CreateService(html, "text/html");

        var info = await service.GetEpisodeInfoAsync("https://pod.example.com/e/great-episode");

        Assert.NotNull(info);
        Assert.Equal("https://cdn.example.com/audio/great.mp3", info!.AudioUrl);
        Assert.Equal("Great Episode", info.Title);
        Assert.Equal("Great Show", info.ShowName);
        Assert.Equal("https://cdn.example.com/art.jpg", info.ThumbnailUrl);
    }

    [Fact]
    public async Task GetEpisodeInfoAsync_PageWithoutAudio_ReturnsNull()
    {
        var service = CreateService("<html><body>Nothing to hear</body></html>", "text/html");

        var info = await service.GetEpisodeInfoAsync("https://pod.example.com/e/silent");

        Assert.Null(info);
    }

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly string _body;
        private readonly string _contentType;

        public StubHandler(string body, string contentType)
        {
            _body = body;
            _contentType = contentType;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_body, System.Text.Encoding.UTF8, _contentType),
                RequestMessage = request,
            };
            return Task.FromResult(response);
        }
    }
}
