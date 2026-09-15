#!/bin/bash
set -euo pipefail

# Copy the API's database from one PostgreSQL server to another — in practice, into a Supabase
# project.
#
#   scripts/migrate-db.sh preflight   # read-only: reports what would happen, changes nothing
#   scripts/migrate-db.sh run         # dump, restore, verify
#   scripts/migrate-db.sh verify      # compare row counts only
#
# The source is only ever read. The target is only written by `run`, and only into an empty database
# unless MIGRATE_FORCE=1 says otherwise.
#
# Connection strings come from the environment in the app's own ADO.NET format (a postgresql:// URL
# works too):
#   SOURCE_CONNECTION_STRING   the database being copied from (required)
#   TARGET_CONNECTION_STRING   defaults to DATABASE_CONNECTION_STRING

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONN="$SCRIPT_DIR/pgconn.py"

if [[ -f "$ROOT_DIR/.env_variables" ]]; then
  # shellcheck source=../.env_variables
  set -a; source "$ROOT_DIR/.env_variables"; set +a
fi

COMMAND="${1:-preflight}"
DUMP_FILE="${DUMP_FILE:-$ROOT_DIR/.migration/source-$(date +%Y%m%d-%H%M%S).dump}"

# Extensions the schema needs. They must live in `public` on the target: pg_dump emits an empty
# search_path and schema-qualifies every type, so a `vector` sitting in Supabase's default
# `extensions` schema makes `public.vector(1536)` unresolvable and the restore fails mid-way.
REQUIRED_EXTENSIONS=(vector pg_trgm)

die() { echo "error: $*" >&2; exit 1; }

command -v pg_dump   >/dev/null || die "pg_dump not found (brew install libpq)"
command -v pg_restore >/dev/null || die "pg_restore not found"
command -v psql      >/dev/null || die "psql not found"

# Runs psql against whichever server the caller's PG* variables currently name.
q() { psql -v ON_ERROR_STOP=1 -tAqc "$1"; }

load_source() {
  local raw="${SOURCE_CONNECTION_STRING:-}"
  [[ -n "$raw" ]] || die "set SOURCE_CONNECTION_STRING for the source database"
  eval "$(python3 "$CONN" "$raw")"
}

load_target() {
  local raw="${TARGET_CONNECTION_STRING:-${DATABASE_CONNECTION_STRING:-}}"
  [[ -n "$raw" ]] || die "set TARGET_CONNECTION_STRING or DATABASE_CONNECTION_STRING to the Supabase connection string"
  eval "$(python3 "$CONN" "$raw")"
}

describe() {
  echo "    server   : $(q 'show server_version;')"
  echo "    database : ${PGDATABASE}@${PGHOST}:${PGPORT} as ${PGUSER}"
  echo "    tables   : $(q "select count(*) from pg_stat_user_tables;") holding $(q "select coalesce(sum(n_live_tup),0) from pg_stat_user_tables;") rows (estimated)"
}

# Per-table exact counts, as "table<TAB>count" sorted by name. Exact, not the planner's estimate:
# this is the evidence that the migration moved everything.
row_counts() {
  q "select string_agg(format('select %L as t, count(*) as c from %I.%I', relname, schemaname, relname), ' union all ')
     from pg_stat_user_tables where schemaname = 'public';" > /tmp/.rowcount-sql
  local sql; sql="$(cat /tmp/.rowcount-sql)"; rm -f /tmp/.rowcount-sql
  [[ -n "$sql" ]] || { : ; return 0; }
  psql -v ON_ERROR_STOP=1 -tAqF$'\t' -c "select t, c from ($sql) x order by t;"
}

check_target_extensions() {
  local missing=() misplaced=()
  for ext in "${REQUIRED_EXTENSIONS[@]}"; do
    local schema; schema="$(q "select extnamespace::regnamespace::text from pg_extension where extname = '$ext';")"
    if [[ -z "$schema" ]]; then
      missing+=("$ext")
    elif [[ "$schema" != "public" ]]; then
      misplaced+=("$ext (in $schema)")
    else
      echo "    extension $ext: present in public ✓"
    fi
  done

  if (( ${#missing[@]} )); then
    echo "    extension(s) NOT INSTALLED: ${missing[*]}" >&2
    echo "      → enable them in Supabase (Dashboard → Database → Extensions), or run:" >&2
    for ext in "${missing[@]}"; do echo "          CREATE EXTENSION IF NOT EXISTS \"$ext\" WITH SCHEMA public;" >&2; done
    return 1
  fi

  if (( ${#misplaced[@]} )); then
    echo "    extension(s) in the wrong schema: ${misplaced[*]}" >&2
    echo "      pg_dump schema-qualifies types against an empty search_path, so the restore needs" >&2
    echo "      these in 'public' or it fails on public.vector(1536). Run on the target:" >&2
    for entry in "${misplaced[@]}"; do echo "          ALTER EXTENSION ${entry%% *} SET SCHEMA public;" >&2; done
    return 1
  fi
  return 0
}

preflight() {
  echo "==> Source (read-only)"
  ( load_source; describe )
  echo
  echo "==> Target"
  ( load_target
    describe
    local existing; existing="$(q "select count(*) from pg_stat_user_tables;")"
    if [[ "$existing" != "0" ]]; then
      echo "    target already has $existing table(s) — 'run' will refuse unless MIGRATE_FORCE=1"
    else
      echo "    target is empty ✓"
    fi
    check_target_extensions ) || return 1
  echo
  echo "Preflight passed. 'run' would dump the source and restore it into the target."
}

run() {
  preflight || die "preflight failed; nothing was changed"

  ( load_target
    local existing; existing="$(q "select count(*) from pg_stat_user_tables;")"
    if [[ "$existing" != "0" && "${MIGRATE_FORCE:-0}" != "1" ]]; then
      die "target is not empty ($existing tables). Re-run with MIGRATE_FORCE=1 only if you mean to restore over it."
    fi )

  mkdir -p "$(dirname "$DUMP_FILE")"

  echo "==> Dumping source → $DUMP_FILE"
  # Custom format so pg_restore creates tables, loads data, and only then adds foreign keys and
  # indexes. A --data-only restore would have to guess an FK-safe table order; this does not.
  # --schema=public keeps CREATE EXTENSION out of the dump: the target owns its own extensions.
  ( load_source
    pg_dump --format=custom --no-owner --no-privileges --no-publications --no-subscriptions \
            --schema=public --file="$DUMP_FILE" )
  echo "    $(du -h "$DUMP_FILE" | cut -f1) written"

  # Every database already has a `public` schema, but --schema=public puts CREATE SCHEMA in the dump
  # anyway. Inside --single-transaction that one "schema already exists" error rolls back the entire
  # restore, so drop those two entries from the table of contents rather than the whole safety net.
  local toc="${DUMP_FILE}.toc"
  pg_restore --list "$DUMP_FILE" \
    | grep -vE '[0-9]+; +[0-9]+ +[0-9]+ +(SCHEMA - public|COMMENT - SCHEMA public)' > "$toc"

  echo "==> Restoring into target"
  local log="${DUMP_FILE}.restore.log"
  # --no-acl/--no-owner because Supabase's roles are not the source's. --single-transaction so a
  # failure leaves the target exactly as it was rather than half-migrated.
  if ! ( load_target
         pg_restore --no-owner --no-privileges --no-acl --single-transaction \
                    --use-list="$toc" --dbname="$PGDATABASE" "$DUMP_FILE" ) > "$log" 2>&1; then
    grep -Ei "error" "$log" >&2 | head -20 || true
    die "restore failed (full log: $log). The target was rolled back and is unchanged."
  fi
  grep -Ei "warning" "$log" >&2 || true
  echo "    restored"

  verify
}

verify() {
  echo "==> Verifying row counts"
  local src tgt
  src="$( load_source; row_counts )"
  tgt="$( load_target; row_counts )"

  local failures=0 table scount tcount
  while IFS=$'\t' read -r table scount; do
    [[ -n "$table" ]] || continue
    tcount="$(awk -F'\t' -v t="$table" '$1==t {print $2}' <<< "$tgt")"
    tcount="${tcount:-MISSING}"
    if [[ "$scount" == "$tcount" ]]; then
      printf "    %-34s %8s = %-8s ✓\n" "$table" "$scount" "$tcount"
    else
      printf "    %-34s %8s ≠ %-8s ✗\n" "$table" "$scount" "$tcount"
      failures=$((failures + 1))
    fi
  done <<< "$src"

  if (( failures )); then
    die "$failures table(s) do not match"
  fi
  echo "    all tables match ✓"
}

case "$COMMAND" in
  preflight) preflight ;;
  run)       run ;;
  verify)    verify ;;
  *)         die "unknown command '$COMMAND' (expected preflight, run, or verify)" ;;
esac
