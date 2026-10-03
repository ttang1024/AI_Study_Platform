using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddJuly2026FeatureBatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "Flashcards",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OcclusionsJson",
                table: "Flashcards",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CourseAudioOverviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ScriptJson = table.Column<string>(type: "text", nullable: true),
                    AudioUrl = table.Column<string>(type: "text", nullable: true),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: false),
                    Error = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseAudioOverviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CourseAudioOverviews_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "CourseId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FlashcardReviewLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FlashcardId = table.Column<Guid>(type: "uuid", nullable: false),
                    Rating = table.Column<int>(type: "integer", nullable: false),
                    StateBefore = table.Column<int>(type: "integer", nullable: false),
                    StabilityBefore = table.Column<double>(type: "double precision", nullable: false),
                    DifficultyBefore = table.Column<double>(type: "double precision", nullable: false),
                    ElapsedDays = table.Column<int>(type: "integer", nullable: false),
                    PredictedRetrievability = table.Column<double>(type: "double precision", nullable: false),
                    StabilityAfter = table.Column<double>(type: "double precision", nullable: false),
                    DifficultyAfter = table.Column<double>(type: "double precision", nullable: false),
                    ScheduledDays = table.Column<int>(type: "integer", nullable: false),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FlashcardReviewLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GroupNotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    State = table.Column<byte[]>(type: "bytea", nullable: false),
                    ContentPreview = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    LastEditedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupNotes_StudyGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "StudyGroups",
                        principalColumn: "StudyGroupId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StreakCoverDays",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StreakCoverDays", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserCalendarFeeds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Url = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserCalendarFeeds", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CourseAudioOverviews_CourseId",
                table: "CourseAudioOverviews",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseAudioOverviews_UserId_CourseId",
                table: "CourseAudioOverviews",
                columns: new[] { "UserId", "CourseId" });

            migrationBuilder.CreateIndex(
                name: "IX_FlashcardReviewLogs_UserId_FlashcardId",
                table: "FlashcardReviewLogs",
                columns: new[] { "UserId", "FlashcardId" });

            migrationBuilder.CreateIndex(
                name: "IX_FlashcardReviewLogs_UserId_ReviewedAt",
                table: "FlashcardReviewLogs",
                columns: new[] { "UserId", "ReviewedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_GroupNotes_GroupId",
                table: "GroupNotes",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_StreakCoverDays_UserId_Date",
                table: "StreakCoverDays",
                columns: new[] { "UserId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserCalendarFeeds_UserId",
                table: "UserCalendarFeeds",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CourseAudioOverviews");

            migrationBuilder.DropTable(
                name: "FlashcardReviewLogs");

            migrationBuilder.DropTable(
                name: "GroupNotes");

            migrationBuilder.DropTable(
                name: "StreakCoverDays");

            migrationBuilder.DropTable(
                name: "UserCalendarFeeds");

            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "Flashcards");

            migrationBuilder.DropColumn(
                name: "OcclusionsJson",
                table: "Flashcards");
        }
    }
}
