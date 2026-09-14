#!/usr/bin/env python3
"""Turn a connection string into libpq PG* environment assignments.

Accepts either the ADO.NET keyword form the app uses
(``Host=h;Port=5432;Database=d;Username=u;Password=p;SSL Mode=Require``) or a
``postgresql://`` URL, and prints shell ``export`` lines.

PG* variables rather than a URL on purpose: a password containing ``@``, ``/`` or
``?`` needs percent-encoding inside a URL and silently authenticates as the wrong
thing when it is missed. Environment variables have no such quoting rule.
"""
import sys
import urllib.parse

# ADO.NET spells several of these more than one way; libpq spells each one once.
KEYS = {
    "host": "PGHOST", "server": "PGHOST", "data source": "PGHOST",
    "port": "PGPORT",
    "database": "PGDATABASE", "initial catalog": "PGDATABASE",
    "username": "PGUSER", "user id": "PGUSER", "userid": "PGUSER", "uid": "PGUSER",
    "password": "PGPASSWORD", "pwd": "PGPASSWORD",
    "ssl mode": "PGSSLMODE", "sslmode": "PGSSLMODE",
    "root certificate": "PGSSLROOTCERT",
}

# Npgsql's SslMode names map onto libpq's, but are not spelled identically.
SSL = {
    "disable": "disable", "allow": "allow", "prefer": "prefer", "require": "require",
    "verifyca": "verify-ca", "verify-ca": "verify-ca",
    "verifyfull": "verify-full", "verify-full": "verify-full",
}


def parse(value: str) -> dict:
    value = value.strip()
    if value.startswith(("postgres://", "postgresql://")):
        u = urllib.parse.urlparse(value)
        out = {}
        if u.hostname:
            out["PGHOST"] = u.hostname
        if u.port:
            out["PGPORT"] = str(u.port)
        if u.username:
            out["PGUSER"] = urllib.parse.unquote(u.username)
        if u.password:
            out["PGPASSWORD"] = urllib.parse.unquote(u.password)
        db = u.path.lstrip("/")
        if db:
            out["PGDATABASE"] = db
        for k, v in urllib.parse.parse_qsl(u.query):
            if k.lower() == "sslmode":
                out["PGSSLMODE"] = SSL.get(v.strip().lower(), v)
        return out

    out = {}
    for part in value.split(";"):
        if "=" not in part:
            continue
        k, _, v = part.partition("=")
        key = KEYS.get(k.strip().lower())
        if not key:
            continue
        v = v.strip()
        if key == "PGSSLMODE":
            v = SSL.get(v.lower(), v.lower())
        out[key] = v
    return out


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: pgconn.py <connection-string>", file=sys.stderr)
        return 2

    parsed = parse(sys.argv[1])
    if not parsed.get("PGHOST"):
        print("could not find a Host in the connection string", file=sys.stderr)
        return 1

    parsed.setdefault("PGPORT", "5432")
    parsed.setdefault("PGDATABASE", "postgres")
    # Anything remote must be encrypted; a local socket or loopback need not be.
    if "PGSSLMODE" not in parsed:
        local = parsed["PGHOST"] in ("localhost", "127.0.0.1", "::1") or parsed["PGHOST"].startswith("/")
        parsed["PGSSLMODE"] = "prefer" if local else "require"

    for k, v in parsed.items():
        print(f"export {k}={_quote(v)}")
    return 0


def _quote(v: str) -> str:
    return "'" + v.replace("'", "'\\''") + "'"


if __name__ == "__main__":
    raise SystemExit(main())
