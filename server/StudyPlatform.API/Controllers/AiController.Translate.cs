using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

// On-demand translation of generated study material.
public partial class AiController
{
    public record TranslateRequest(string Text, string TargetLanguage);

    /// <summary>
    /// Translates a piece of study material.
    ///
    /// Takes the text in the request rather than an artifact id, and stores nothing: the caller
    /// already has the material on screen, translations are a view of it rather than a second copy,
    /// and persisting one per language per artifact would multiply the library for no lasting gain.
    /// </summary>
    [HttpPost("translate")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> Translate(
        [FromBody] TranslateRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(BaseResponse<string>.Fail("There is nothing to translate.", "NO_TEXT"));

        if (string.IsNullOrWhiteSpace(request.TargetLanguage))
            return BadRequest(BaseResponse<string>.Fail("No target language given.", "NO_LANGUAGE"));

        var translated = await _aiService.TranslateAsync(
            request.Text, request.TargetLanguage.Trim(), cancellationToken);

        return Ok(BaseResponse<string>.Ok(translated));
    }
}
