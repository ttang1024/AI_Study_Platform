using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkedProblemMastered : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WorkedProblemMastered",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkedProblemId = table.Column<Guid>(type: "uuid", nullable: false),
                    MasteredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkedProblemMastered", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkedProblemMastered_WorkedProblems_WorkedProblemId",
                        column: x => x.WorkedProblemId,
                        principalTable: "WorkedProblems",
                        principalColumn: "WorkedProblemId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkedProblemMastered_UserId_WorkedProblemId",
                table: "WorkedProblemMastered",
                columns: new[] { "UserId", "WorkedProblemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkedProblemMastered_WorkedProblemId",
                table: "WorkedProblemMastered",
                column: "WorkedProblemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkedProblemMastered");
        }
    }
}
