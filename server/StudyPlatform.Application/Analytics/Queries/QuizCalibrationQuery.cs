using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Analytics.Queries;

// ── DTOs ──────────────────────────────────────────────────────────────────────

/// <param name="AccuracyPercent">How often answers rated at this confidence were actually right.</param>
public record ConfidenceBinDto(
    int Level,
    string Label,
    int Answered,
    int Correct,
    double AccuracyPercent);

/// <summary>A question the learner was sure about and still got wrong.</summary>
public record ConfidentMistakeDto(
    Guid QuizId,
    string Question,
    string CorrectAnswer,
    string YourAnswer);

/// <param name="OverconfidenceGap">
/// Percentage points between being certain and being right: 100 minus accuracy in the "Confident" bin.
/// Null when nothing has been rated confident yet. This is the number the whole feature exists to show —
/// a wrong answer you knew was a guess costs you nothing, but one you were sure of is a belief you will
/// keep acting on until something corrects it.
/// </param>
public record QuizCalibrationDto(
    IReadOnlyList<ConfidenceBinDto> Bins,
    int RatedAnswers,
    int ConfidentWrong,
    int GuessedRight,
    double? OverconfidenceGap,
    IReadOnlyList<ConfidentMistakeDto> ConfidentMistakes);

// ── Query ─────────────────────────────────────────────────────────────────────

/// <summary>
/// Compares how sure the learner felt against how right they actually were.
///
/// Distinct from the FSRS calibration in <see cref="GetRetentionAnalyticsQuery"/>, which measures the
/// *scheduler's* predicted recall against reality. This measures the *learner's* self-assessment, which
/// is the thing they can act on: it tells them which of their confident beliefs are wrong.
/// </summary>
public record GetQuizCalibrationQuery(Guid UserId) : IRequest<Result<QuizCalibrationDto>>;

public class GetQuizCalibrationQueryHandler : IRequestHandler<GetQuizCalibrationQuery, Result<QuizCalibrationDto>>
{
    /// <summary>Cap on the worked list of confident mistakes — it is a to-do list, not an archive.</summary>
    private const int MaxConfidentMistakes = 20;

    private readonly IUnitOfWork _unitOfWork;

    public GetQuizCalibrationQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<QuizCalibrationDto>> Handle(GetQuizCalibrationQuery request, CancellationToken ct)
    {
        var userId = request.UserId;

        var submissions = (await _unitOfWork.QuizSubmissions.GetAllByUserAsync(userId, ct))
            // Submissions predating confidence capture have nothing to say here.
            .Where(s => !string.IsNullOrWhiteSpace(s.ConfidenceJson))
            .ToList();

        if (submissions.Count == 0)
            return Result<QuizCalibrationDto>.Success(Empty());

        var quizzes = (await _unitOfWork.Quizzes.FindAsNoTrackingAsync(q => q.UserId == userId, ct))
            .ToDictionary(q => q.QuizId);

        // level -> (answered, correct)
        var answered = new Dictionary<int, int>();
        var correct = new Dictionary<int, int>();
        var confidentMistakes = new List<ConfidentMistakeDto>();
        var guessedRight = 0;

        foreach (var submission in submissions)
        {
            var answers = DeserializeAnswers(submission.AnswersJson);
            var confidence = ConfidenceSerializer.Deserialize(submission.ConfidenceJson);

            foreach (var (quizIdKey, level) in confidence)
            {
                // A rating with no answer beside it, or for a quiz since deleted, is not evidence.
                if (!answers.TryGetValue(quizIdKey, out var given))
                    continue;
                if (!Guid.TryParse(quizIdKey, out var quizId) || !quizzes.TryGetValue(quizId, out var quiz))
                    continue;

                var isCorrect = QuizAnswerComparer.IsCorrect(given, quiz.CorrectAnswer);

                answered[level] = answered.GetValueOrDefault(level) + 1;
                if (isCorrect)
                    correct[level] = correct.GetValueOrDefault(level) + 1;

                if (level == ConfidenceLevel.Confident && !isCorrect && confidentMistakes.Count < MaxConfidentMistakes)
                {
                    confidentMistakes.Add(new ConfidentMistakeDto(
                        quiz.QuizId, quiz.Question, quiz.CorrectAnswer, given));
                }

                if (level == ConfidenceLevel.Guessing && isCorrect)
                    guessedRight++;
            }
        }

        var bins = new[] { ConfidenceLevel.Guessing, ConfidenceLevel.Unsure, ConfidenceLevel.Confident }
            .Select(level =>
            {
                var total = answered.GetValueOrDefault(level);
                var right = correct.GetValueOrDefault(level);
                return new ConfidenceBinDto(
                    level,
                    ConfidenceLevel.Label(level),
                    total,
                    right,
                    total > 0 ? Math.Round((double)right / total * 100, 1) : 0);
            })
            .ToList();

        var confidentBin = bins.Single(b => b.Level == ConfidenceLevel.Confident);
        var ratedAnswers = bins.Sum(b => b.Answered);

        if (ratedAnswers == 0)
            return Result<QuizCalibrationDto>.Success(Empty());

        return Result<QuizCalibrationDto>.Success(new QuizCalibrationDto(
            bins,
            ratedAnswers,
            confidentBin.Answered - confidentBin.Correct,
            guessedRight,
            confidentBin.Answered > 0 ? Math.Round(100 - confidentBin.AccuracyPercent, 1) : null,
            confidentMistakes));
    }

    private static QuizCalibrationDto Empty() => new(
        [
            new ConfidenceBinDto(ConfidenceLevel.Guessing, ConfidenceLevel.Label(ConfidenceLevel.Guessing), 0, 0, 0),
            new ConfidenceBinDto(ConfidenceLevel.Unsure, ConfidenceLevel.Label(ConfidenceLevel.Unsure), 0, 0, 0),
            new ConfidenceBinDto(ConfidenceLevel.Confident, ConfidenceLevel.Label(ConfidenceLevel.Confident), 0, 0, 0),
        ],
        0, 0, 0, null, []);

    private static Dictionary<string, string> DeserializeAnswers(string answersJson)
    {
        if (string.IsNullOrWhiteSpace(answersJson))
            return new Dictionary<string, string>();

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(answersJson)
                   ?? new Dictionary<string, string>();
        }
        catch (JsonException)
        {
            return new Dictionary<string, string>();
        }
    }
}
