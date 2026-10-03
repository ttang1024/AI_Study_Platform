using System.Net;
using StudyPlatform.Infrastructure.Http;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class SsrfGuardTests
{
    [Theory]
    [InlineData("127.0.0.1")]        // loopback
    [InlineData("127.5.6.7")]        // loopback (whole 127/8)
    [InlineData("0.0.0.0")]          // "this network"
    [InlineData("10.0.0.5")]         // RFC1918
    [InlineData("172.16.0.1")]       // RFC1918
    [InlineData("172.31.255.254")]   // RFC1918 upper bound
    [InlineData("192.168.1.1")]      // RFC1918
    [InlineData("169.254.169.254")]  // link-local — AWS/GCP metadata
    [InlineData("100.64.0.1")]       // CGNAT
    [InlineData("224.0.0.1")]        // multicast
    [InlineData("255.255.255.255")]  // broadcast
    [InlineData("::1")]              // IPv6 loopback
    [InlineData("fe80::1")]          // IPv6 link-local
    [InlineData("fc00::1")]          // IPv6 unique-local
    [InlineData("::ffff:169.254.169.254")] // IPv4-mapped metadata address
    public void IsBlocked_RejectsPrivateAndReservedAddresses(string ip)
    {
        Assert.True(SsrfGuard.IsBlocked(IPAddress.Parse(ip)), $"{ip} should be blocked");
    }

    [Theory]
    [InlineData("8.8.8.8")]          // public
    [InlineData("1.1.1.1")]          // public
    [InlineData("172.32.0.1")]       // just outside 172.16/12
    [InlineData("172.15.255.255")]   // just below 172.16/12
    [InlineData("100.63.255.255")]   // just below CGNAT 100.64/10
    [InlineData("100.128.0.1")]      // just above CGNAT 100.64/10
    [InlineData("192.167.0.1")]      // not 192.168
    [InlineData("2606:4700:4700::1111")] // public IPv6 (Cloudflare)
    public void IsBlocked_AllowsPublicAddresses(string ip)
    {
        Assert.False(SsrfGuard.IsBlocked(IPAddress.Parse(ip)), $"{ip} should be allowed");
    }
}
