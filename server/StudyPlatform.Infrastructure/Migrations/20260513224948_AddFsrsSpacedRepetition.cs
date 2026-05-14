using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFsrsSpacedRepetition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FlashcardSrs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FlashcardId = table.Column<Guid>(type: "uuid", nullable: false),
                    State = table.Column<int>(type: "integer", nullable: false),
                    Stability = table.Column<double>(type: "double precision", nullable: false),
                    Difficulty = table.Column<double>(type: "double precision", nullable: false),
                    Reps = table.Column<int>(type: "integer", nullable: false),
                    Lapses = table.Column<int>(type: "integer", nullable: false),
                    ScheduledDays = table.Column<int>(type: "integer", nullable: false),
                    ElapsedDays = table.Column<int>(type: "integer", nullable: false),
                    LastReview = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Due = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FlashcardSrs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FlashcardSrs_Flashcards_FlashcardId",
                        column: x => x.FlashcardId,
                        principalTable: "Flashcards",
                        principalColumn: "FlashcardId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FlashcardSrs_FlashcardId",
                table: "FlashcardSrs",
                column: "FlashcardId");

            migrationBuilder.CreateIndex(
                name: "IX_FlashcardSrs_UserId_Due",
                table: "FlashcardSrs",
                columns: new[] { "UserId", "Due" });

            migrationBuilder.CreateIndex(
                name: "IX_FlashcardSrs_UserId_FlashcardId",
                table: "FlashcardSrs",
                columns: new[] { "UserId", "FlashcardId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FlashcardSrs");
        }
    }
}
