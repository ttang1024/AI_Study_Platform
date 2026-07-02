namespace StudyPlatform.Application.Settings;

public class CacheOptions
{
    public const string SectionName = "Cache";

    public int DashboardStatsSeconds { get; set; } = 60;
    public int AnalyticsSummarySeconds { get; set; } = 30;
    public int KnowledgeGraphSeconds { get; set; } = 300;
    public int GeneratedResultSeconds { get; set; } = 2592000;
    public int SasUrlSeconds { get; set; } = 3000;
    public int OperationTimeoutMilliseconds { get; set; } = 500;
    public int TranscriptSeconds { get; set; } = 2592000; // 30 days
}
