using System.Net;
using System.Net.Sockets;

namespace StudyPlatform.Infrastructure.Http;

/// <summary>
/// SSRF protection for HttpClients that fetch user-supplied URLs (calendar feeds, podcast/clipper
/// pages). Builds a <see cref="SocketsHttpHandler"/> whose <see cref="SocketsHttpHandler.ConnectCallback"/>
/// resolves the target host and refuses to open a socket to a private, loopback, link-local, or
/// otherwise reserved address.
///
/// Doing the check in ConnectCallback — rather than validating the request URL up front — is what
/// makes it sound: the callback fires for the initial request <em>and every redirect hop</em>, so a
/// public URL that 302s to http://169.254.169.254 is still caught. And because we resolve the host
/// once and connect to that exact validated IP, there is no window for DNS rebinding between the
/// check and the connection.
/// </summary>
public static class SsrfGuard
{
    public static SocketsHttpHandler CreateHandler(
        DecompressionMethods decompression = DecompressionMethods.All,
        int maxRedirects = 5)
    {
        var handler = new SocketsHttpHandler
        {
            AutomaticDecompression = decompression,
            AllowAutoRedirect = maxRedirects > 0,
            MaxAutomaticRedirections = Math.Max(1, maxRedirects),
            ConnectTimeout = TimeSpan.FromSeconds(10),
            ConnectCallback = ConnectAsync,
        };
        return handler;
    }

    private static async ValueTask<Stream> ConnectAsync(
        SocketsHttpConnectionContext context, CancellationToken cancellationToken)
    {
        var host = context.DnsEndPoint.Host;

        var addresses = await Dns.GetHostAddressesAsync(host, cancellationToken);
        // Connect to the first public address we find. Skipping (rather than failing on) a blocked
        // address is deliberate: a dual-stack host that publishes both a public and a private record
        // should still be reachable over its public one.
        var target = Array.Find(addresses, a => !IsBlocked(a))
            ?? throw new HttpRequestException(
                $"Refusing to connect to '{host}': it resolves only to a private or reserved address.");

        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(new IPEndPoint(target, context.DnsEndPoint.Port), cancellationToken);
            // Returning a bare NetworkStream lets SocketsHttpHandler layer TLS on top itself, using the
            // request's hostname for SNI and certificate validation — so pinning the IP doesn't weaken HTTPS.
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }

    /// <summary>
    /// True for addresses an outbound fetch of untrusted input must never reach: loopback, the
    /// 0.0.0.0/:: unspecified addresses, RFC 1918 / unique-local private ranges, link-local
    /// (including the 169.254.169.254 cloud-metadata endpoint), CGNAT, and multicast/reserved space.
    /// </summary>
    public static bool IsBlocked(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
            address = address.MapToIPv4();

        if (IPAddress.IsLoopback(address))
            return true;

        var bytes = address.GetAddressBytes();

        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            return bytes[0] switch
            {
                0 => true,                              // 0.0.0.0/8 "this network"
                10 => true,                             // 10.0.0.0/8 private
                100 => bytes[1] >= 64 && bytes[1] <= 127, // 100.64.0.0/10 CGNAT
                127 => true,                            // loopback (also caught above)
                169 => bytes[1] == 254,                 // 169.254.0.0/16 link-local (cloud metadata)
                172 => bytes[1] >= 16 && bytes[1] <= 31, // 172.16.0.0/12 private
                192 => bytes[1] == 168,                 // 192.168.0.0/16 private
                >= 224 => true,                         // 224/4 multicast + 240/4 reserved + broadcast
                _ => false,
            };
        }

        // IPv6
        if (address.IsIPv6LinkLocal || address.IsIPv6SiteLocal || address.IsIPv6Multicast)
            return true;
        if (address.Equals(IPAddress.IPv6Any))          // ::
            return true;
        return (bytes[0] & 0xFE) == 0xFC;               // fc00::/7 unique local
    }
}
