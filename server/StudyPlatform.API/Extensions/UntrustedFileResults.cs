using Microsoft.AspNetCore.Mvc;

namespace StudyPlatform.API.Extensions;

/// <summary>
/// Serving a user-uploaded file whose content type the uploader chose.
///
/// <para>Uploads accept HTML, XHTML and SVG, and the stored content type is whatever the uploading
/// client claimed. Served inline from the API origin, such a file runs script there — and the API origin
/// holds the refresh-token cookie, so that script can mint access tokens for whoever opened the link.
/// Every client reads these endpoints with fetch / pdf.js / media elements, never by navigating to them,
/// so the response can be made inert for a browser tab without affecting any of them: a download rather
/// than a page, no MIME sniffing, and a sandbox CSP in case a browser renders it anyway.</para>
/// </summary>
public static class UntrustedFileResults
{
    public static FileStreamResult UntrustedFile(
        this ControllerBase controller, Stream stream, string? contentType, bool enableRangeProcessing = false)
    {
        var headers = controller.Response.Headers;
        headers.ContentDisposition = "attachment";
        headers.XContentTypeOptions = "nosniff";
        headers.ContentSecurityPolicy = "default-src 'none'; sandbox";

        var result = controller.File(
            stream,
            string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType);
        result.EnableRangeProcessing = enableRangeProcessing;
        return result;
    }
}
