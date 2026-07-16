namespace StudyPlatform.Application.Services;

/// <summary>Thrown when a user has spent their daily AI token budget. Surfaces as HTTP 429.</summary>
public class AiQuotaExceededException : Exception
{
    public AiQuotaExceededException(long tokensUsed, long dailyLimit)
        : base($"Daily AI token limit reached ({tokensUsed:N0} of {dailyLimit:N0}). It resets at midnight UTC.")
    {
        TokensUsed = tokensUsed;
        DailyLimit = dailyLimit;
    }

    public long TokensUsed { get; }
    public long DailyLimit { get; }
}
