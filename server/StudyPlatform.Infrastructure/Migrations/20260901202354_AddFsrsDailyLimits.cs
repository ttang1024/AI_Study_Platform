using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFsrsDailyLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MaxReviewsPerDay",
                table: "UserFsrsSettings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // 20, not EF's 0: the entity default is 20 and both clients hard-coded 20 before this
            // column existed, so backfilling 0 would silently stop new cards being introduced for
            // anyone who already has a settings row.
            migrationBuilder.AddColumn<int>(
                name: "NewCardsPerDay",
                table: "UserFsrsSettings",
                type: "integer",
                nullable: false,
                defaultValue: 20);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxReviewsPerDay",
                table: "UserFsrsSettings");

            migrationBuilder.DropColumn(
                name: "NewCardsPerDay",
                table: "UserFsrsSettings");
        }
    }
}
