using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

public class OAuthService : IOAuthService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<OAuthService> _logger;

    public OAuthService(HttpClient httpClient, IConfiguration configuration, ILogger<OAuthService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<OAuthUserInfo?> GetUserInfoAsync(string provider, string code, string redirectUri, CancellationToken cancellationToken = default)
    {
        return provider.ToLowerInvariant() switch
        {
            "google" => await GetGoogleUserInfoAsync(code, redirectUri, cancellationToken),
            "github" => await GetGitHubUserInfoAsync(code, redirectUri, cancellationToken),
            _ => null
        };
    }

    private async Task<OAuthUserInfo?> GetGoogleUserInfoAsync(string code, string redirectUri, CancellationToken cancellationToken)
    {
        var clientId = _configuration["GoogleOAuth:ClientId"];
        var clientSecret = _configuration["GoogleOAuth:ClientSecret"];
        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
        {
            _logger.LogError("Google OAuth client ID or secret is not configured.");
            return null;
        }

        var tokenResponse = await _httpClient.PostAsync("https://oauth2.googleapis.com/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["code"] = code,
                ["client_id"] = clientId,
                ["client_secret"] = clientSecret,
                ["redirect_uri"] = redirectUri,
                ["grant_type"] = "authorization_code"
            }), cancellationToken);

        if (!tokenResponse.IsSuccessStatusCode)
        {
            var body = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Google token exchange failed: {Status} {Body} (redirect_uri={RedirectUri})",
                tokenResponse.StatusCode, body, redirectUri);
            return null;
        }

        var tokenData = await tokenResponse.Content.ReadFromJsonAsync<GoogleTokenResponse>(cancellationToken: cancellationToken);
        if (tokenData?.AccessToken == null)
        {
            _logger.LogError("Google token response missing access_token.");
            return null;
        }

        using var infoRequest = new HttpRequestMessage(HttpMethod.Get, "https://www.googleapis.com/oauth2/v2/userinfo");
        infoRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenData.AccessToken);
        var infoResponse = await _httpClient.SendAsync(infoRequest, cancellationToken);
        if (!infoResponse.IsSuccessStatusCode)
        {
            _logger.LogError("Google userinfo request failed: {Status}", infoResponse.StatusCode);
            return null;
        }

        var userInfo = await infoResponse.Content.ReadFromJsonAsync<GoogleUserInfo>(cancellationToken: cancellationToken);
        if (userInfo?.Email == null)
        {
            _logger.LogError("Google userinfo response missing email.");
            return null;
        }

        return new OAuthUserInfo(userInfo.Email, userInfo.Name ?? userInfo.Email.Split('@')[0]);
    }

    private async Task<OAuthUserInfo?> GetGitHubUserInfoAsync(string code, string redirectUri, CancellationToken cancellationToken)
    {
        var clientId = _configuration["GitHubOAuth:ClientId"];
        var clientSecret = _configuration["GitHubOAuth:ClientSecret"];
        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
        {
            _logger.LogError("GitHub OAuth client ID or secret is not configured.");
            return null;
        }

        using var tokenRequest = new HttpRequestMessage(HttpMethod.Post, "https://github.com/login/oauth/access_token");
        tokenRequest.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
        tokenRequest.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = clientId,
            ["client_secret"] = clientSecret,
            ["redirect_uri"] = redirectUri
        });

        var tokenResponse = await _httpClient.SendAsync(tokenRequest, cancellationToken);

        if (!tokenResponse.IsSuccessStatusCode)
        {
            var body = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("GitHub token exchange failed: {Status} {Body} (redirect_uri={RedirectUri})",
                tokenResponse.StatusCode, body, redirectUri);
            return null;
        }

        GitHubTokenResponse? tokenData;
        try { tokenData = await tokenResponse.Content.ReadFromJsonAsync<GitHubTokenResponse>(cancellationToken: cancellationToken); }
        catch { tokenData = null; }
        if (tokenData?.AccessToken == null)
        {
            _logger.LogError("GitHub token response missing access_token.");
            return null;
        }

        using var userRequest = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user");
        userRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenData.AccessToken);
        var userResponse = await _httpClient.SendAsync(userRequest, cancellationToken);
        if (!userResponse.IsSuccessStatusCode)
        {
            _logger.LogError("GitHub user request failed: {Status}", userResponse.StatusCode);
            return null;
        }

        var gitHubUser = await userResponse.Content.ReadFromJsonAsync<GitHubUser>(cancellationToken: cancellationToken);
        if (gitHubUser == null)
        {
            _logger.LogError("GitHub user response could not be parsed.");
            return null;
        }

        var email = gitHubUser.Email;
        if (string.IsNullOrEmpty(email))
        {
            using var emailRequest = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user/emails");
            emailRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenData.AccessToken);
            var emailResponse = await _httpClient.SendAsync(emailRequest, cancellationToken);
            if (emailResponse.IsSuccessStatusCode)
            {
                var emails = await emailResponse.Content.ReadFromJsonAsync<List<GitHubEmail>>(cancellationToken: cancellationToken);
                email = emails?.FirstOrDefault(e => e.Primary && e.Verified)?.Email
                     ?? emails?.FirstOrDefault(e => e.Verified)?.Email
                     ?? emails?.FirstOrDefault()?.Email;
            }
        }

        if (string.IsNullOrEmpty(email))
        {
            _logger.LogError("GitHub OAuth: could not retrieve user email.");
            return null;
        }

        var fullName = gitHubUser.Name ?? gitHubUser.Login ?? email.Split('@')[0];
        return new OAuthUserInfo(email, fullName);
    }
}

// Internal JSON models
file record GoogleTokenResponse([property: JsonPropertyName("access_token")] string? AccessToken);
file record GoogleUserInfo([property: JsonPropertyName("email")] string? Email, [property: JsonPropertyName("name")] string? Name);
file record GitHubTokenResponse([property: JsonPropertyName("access_token")] string? AccessToken);

file class GitHubUser
{
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("login")] public string? Login { get; set; }
}

file record GitHubEmail(
    [property: JsonPropertyName("email")] string? Email,
    [property: JsonPropertyName("primary")] bool Primary,
    [property: JsonPropertyName("verified")] bool Verified);
