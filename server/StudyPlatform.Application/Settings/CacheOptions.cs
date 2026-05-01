namespace StudyPlatform.Application.Settings;

public class CacheOptions
{
    public const string SectionName = "Cache";

    public int DashboardStatsSeconds { get; set; } = 60;
    public int AnalyticsSummarySeconds { get; set; } = 30;
    public int GeneratedResultSeconds { get; set; } = 86400;
    public int SasUrlSeconds { get; set; } = 3000;
    public int OperationTimeoutMilliseconds { get; set; } = 500;
}
