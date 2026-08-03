using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LibraryTagsAndSavedViews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LibraryTags",
                columns: table => new
                {
                    LibraryTagId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Color = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Description = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryTags", x => x.LibraryTagId);
                    table.ForeignKey(
                        name: "FK_LibraryTags_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SavedLibraryViews",
                columns: table => new
                {
                    SavedLibraryViewId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Icon = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    FiltersJson = table.Column<string>(type: "text", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedLibraryViews", x => x.SavedLibraryViewId);
                    table.ForeignKey(
                        name: "FK_SavedLibraryViews_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LibraryTagAssignments",
                columns: table => new
                {
                    LibraryTagId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemKind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryTagAssignments", x => new { x.LibraryTagId, x.ItemKind, x.ItemId });
                    table.ForeignKey(
                        name: "FK_LibraryTagAssignments_LibraryTags_LibraryTagId",
                        column: x => x.LibraryTagId,
                        principalTable: "LibraryTags",
                        principalColumn: "LibraryTagId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryTagAssignments_ItemKind_ItemId",
                table: "LibraryTagAssignments",
                columns: new[] { "ItemKind", "ItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryTags_User_Kind_Name",
                table: "LibraryTags",
                columns: new[] { "UserId", "Kind", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SavedLibraryViews_UserId_Position",
                table: "SavedLibraryViews",
                columns: new[] { "UserId", "Position" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LibraryTagAssignments");

            migrationBuilder.DropTable(
                name: "SavedLibraryViews");

            migrationBuilder.DropTable(
                name: "LibraryTags");
        }
    }
}
