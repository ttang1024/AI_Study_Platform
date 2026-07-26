using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEssaysAndRubrics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Rubrics",
                columns: table => new
                {
                    RubricId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CriteriaJson = table.Column<string>(type: "text", nullable: false),
                    ClassroomId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rubrics", x => x.RubricId);
                    table.ForeignKey(
                        name: "FK_Rubrics_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EssaySubmissions",
                columns: table => new
                {
                    EssaySubmissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RubricId = table.Column<Guid>(type: "uuid", nullable: true),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    PromptText = table.Column<string>(type: "text", nullable: true),
                    Text = table.Column<string>(type: "text", nullable: false),
                    WordCount = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ParentSubmissionId = table.Column<Guid>(type: "uuid", nullable: true),
                    FeedbackJson = table.Column<string>(type: "text", nullable: true),
                    ScorePercent = table.Column<double>(type: "double precision", nullable: true),
                    GradedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EssaySubmissions", x => x.EssaySubmissionId);
                    table.ForeignKey(
                        name: "FK_EssaySubmissions_Rubrics_RubricId",
                        column: x => x.RubricId,
                        principalTable: "Rubrics",
                        principalColumn: "RubricId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_EssaySubmissions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EssaySubmissions_ParentSubmissionId",
                table: "EssaySubmissions",
                column: "ParentSubmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_EssaySubmissions_RubricId",
                table: "EssaySubmissions",
                column: "RubricId");

            migrationBuilder.CreateIndex(
                name: "IX_EssaySubmissions_UserId",
                table: "EssaySubmissions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Rubrics_UserId",
                table: "Rubrics",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EssaySubmissions");

            migrationBuilder.DropTable(
                name: "Rubrics");
        }
    }
}
