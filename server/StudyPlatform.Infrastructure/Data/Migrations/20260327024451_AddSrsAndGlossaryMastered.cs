using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSrsAndGlossaryMastered : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FlashcardSrsData",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FlashcardId = table.Column<Guid>(type: "uuid", nullable: false),
                    Interval = table.Column<int>(type: "integer", nullable: false),
                    EaseFactor = table.Column<double>(type: "double precision", nullable: false),
                    Repetitions = table.Column<int>(type: "integer", nullable: false),
                    NextReview = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastReviewed = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FlashcardSrsData", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FlashcardSrsData_Flashcards_FlashcardId",
                        column: x => x.FlashcardId,
                        principalTable: "Flashcards",
                        principalColumn: "FlashcardId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GlossaryMastered",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    GlossaryTermId = table.Column<Guid>(type: "uuid", nullable: false),
                    MasteredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GlossaryMastered", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GlossaryMastered_GlossaryTerms_GlossaryTermId",
                        column: x => x.GlossaryTermId,
                        principalTable: "GlossaryTerms",
                        principalColumn: "GlossaryTermId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FlashcardSrsData_FlashcardId",
                table: "FlashcardSrsData",
                column: "FlashcardId");

            migrationBuilder.CreateIndex(
                name: "IX_FlashcardSrsData_UserId_FlashcardId",
                table: "FlashcardSrsData",
                columns: new[] { "UserId", "FlashcardId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GlossaryMastered_GlossaryTermId",
                table: "GlossaryMastered",
                column: "GlossaryTermId");

            migrationBuilder.CreateIndex(
                name: "IX_GlossaryMastered_UserId_GlossaryTermId",
                table: "GlossaryMastered",
                columns: new[] { "UserId", "GlossaryTermId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FlashcardSrsData");

            migrationBuilder.DropTable(
                name: "GlossaryMastered");
        }
    }
}
