using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSummaryAndMindMapVersions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1, not EF's generated 0, matching ContentVersion's own backfill: existing summaries and
            // mind maps were built from their document's first version. Backfilling 0 would put every
            // one of them below ContentVersion on the very first read, so every document in the
            // library would announce itself out of date the moment this deployed.
            migrationBuilder.AddColumn<int>(
                name: "MindMapVersion",
                table: "Documents",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "SummaryVersion",
                table: "Documents",
                type: "integer",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MindMapVersion",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "SummaryVersion",
                table: "Documents");
        }
    }
}
