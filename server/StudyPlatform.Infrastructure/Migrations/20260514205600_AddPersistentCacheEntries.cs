using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPersistentCacheEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CacheEntries",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Value = table.Column<byte[]>(type: "bytea", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CacheEntries", x => x.Key);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CacheEntries_ExpiresAt",
                table: "CacheEntries",
                column: "ExpiresAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CacheEntries");
        }
    }
}
