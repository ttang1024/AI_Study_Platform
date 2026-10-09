using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRefreshTokenHashing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Refresh tokens are now looked up by SHA-256 digest (RefreshTokenHash). Convert the rows that
            // hold a raw token, in place, with the same encoding, so every live session keeps working.
            // A raw token is base64 (88 chars, may contain + / =); a digest is exactly 64 lowercase hex
            // chars — the guard makes the statement safe to run twice.
            migrationBuilder.Sql(@"
                UPDATE ""RefreshTokens""
                SET ""Token"" = encode(sha256(convert_to(""Token"", 'UTF8')), 'hex')
                WHERE ""Token"" !~ '^[0-9a-f]{64}$';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Irreversible by design: a digest cannot be turned back into the token. Rolling back leaves
            // every stored token unmatchable, which signs everyone out — safe, just inconvenient.
        }
    }
}
