using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserFsrsSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserFsrsSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DesiredRetention = table.Column<double>(type: "double precision", nullable: false),
                    MaximumIntervalDays = table.Column<int>(type: "integer", nullable: false),
                    EnableFuzz = table.Column<bool>(type: "boolean", nullable: false),
                    WeightsJson = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    WeightsOptimizedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewsAtOptimization = table.Column<int>(type: "integer", nullable: false),
                    LogLossBefore = table.Column<double>(type: "double precision", nullable: true),
                    LogLossAfter = table.Column<double>(type: "double precision", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserFsrsSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserFsrsSettings_UserId",
                table: "UserFsrsSettings",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserFsrsSettings");
        }
    }
}
