using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;

namespace StudyPlatform.Infrastructure.Services;

// OCR and evaluation/worked-problem/Q&A generation endpoints.
public partial class AiService
{
    // ── OCR ───────────────────────────────────────────────────────────────

    public Task<string> ExtractTextFromImageAsync(byte[] imageData, string mimeType, CancellationToken cancellationToken = default)
        => CallAiWithFileAsync(imageData, mimeType,
            "Extract all text visible in this image verbatim. Return only the raw extracted text, no commentary.",
            cancellationToken, cleanJson: false);

    // ── Phase 2 additions ─────────────────────────────────────────────────

    public Task<string> GenerateWorkedProblemsAsync(string content, string difficulty, int count, CancellationToken cancellationToken = default)
    {
        var prompt = $@"Generate {count} {difficulty}-difficulty worked problems from the supplied study material. Do not use meta phrases such as ""this document"", ""the document"", ""this video"", ""the video"", ""the transcript"", ""the source material"", ""the content"", or similar wording in any generated field. Return a JSON array where each element has: problem (string), steps (array of objects with stepNumber (int), description (string), formula (string, optional)), answer (string), topic (string). Return ONLY the JSON array, no other text.

Source material:
{AiResponseParsing.TruncateContent(content)}";
        return CacheGeneratedResultAsync(
            "worked-problems:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    public Task<string> EvaluateProblemAttemptAsync(string problem, string solution, string userAnswer, CancellationToken cancellationToken = default)
    {
        var prompt = $@"Evaluate the student's answer to this problem. Return a JSON object with: isCorrect (bool), evaluation (string, constructive feedback explaining why the answer is correct or incorrect and what was missed).

Problem: {problem}
Correct Solution: {solution}
Student Answer: {userAnswer}

Return ONLY the JSON object, no other text.";
        return SendTextAsync(null, [("user", prompt)], 0.3, 1024, cleanJson: true, cancellationToken);
    }

    public Task<string> EvaluateExplanationAsync(string topic, string reference, string explanation, CancellationToken cancellationToken = default)
    {
        var prompt = $@"A learner is practicing the Feynman technique: explaining a concept in their own words from memory. Grade their explanation against the reference. Be encouraging but honest — reward correct ideas expressed in the learner's own words, and call out genuinely missing or wrong points. Do not penalize informal wording.

Return a JSON object with:
- score: integer 0-100 (how completely and correctly the explanation covers the reference)
- strengths: array of short strings (ideas the learner got right; empty if none)
- gaps: array of short strings (important points that are missing or wrong; empty if none)
- suggestion: one short, actionable sentence telling the learner what to focus on next

Concept: {topic}

Reference explanation:
{AiResponseParsing.TruncateContent(reference, 3000)}

Learner's explanation:
{AiResponseParsing.TruncateContent(explanation, 3000)}

Return ONLY the JSON object, no other text.";
        return SendTextAsync(null, [("user", prompt)], 0.3, 1024, cleanJson: true, cancellationToken);
    }

    public Task<string> AnswerQuestionAsync(string documentContent, string question, CancellationToken cancellationToken = default)
    {
        var prompt = $@"Answer the following question using the supplied source context when relevant. Give a clear, accurate, and helpful answer. Do not mention the source format or use meta phrases such as ""this document"", ""the document"", ""this video"", ""the video"", ""the transcript"", ""the source material"", ""the content"", or similar wording unless quoting the user.

Source context:
{AiResponseParsing.TruncateContent(documentContent, 4000)}

Question: {question}

Answer:";
        return SendTextAsync(null, [("user", prompt)], 0.5, 2048, cleanJson: false, cancellationToken);
    }

}
