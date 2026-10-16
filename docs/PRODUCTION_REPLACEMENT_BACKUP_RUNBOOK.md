# ADAMARKET → CRM SaaS: backup and recovery gate

**Status: NOT BACKED UP / NOT RESTORE-VERIFIED.** This document is a runbook, not proof that a backup exists.

## Safety gate

Do not delete marketplace tables, Auth users, Storage objects, GitHub source files, DNS settings, or production deployment artifacts until every required check below is completed and separately approved.

Production Supabase project: `nmskpqugwiwdcukqckcy`  
GitHub repository: `SECURLINESYSTEMS/ADAMARKET`  
Current Supabase organization plan observed during audit: Free.  
Supabase Postgres observed during audit: 17.6.1.155.

The available Supabase connector can inspect project metadata and run read-only SQL, but it does not provide a downloadable full database dump or a restore-test operation. A person with database credentials must run the CLI export on a trusted computer. Never send database passwords, access tokens, service-role keys, or connection strings in chat or commit them to GitHub.

## Backup components — all are required

1. **Database roles, schema and data** — export with the official Supabase CLI.
2. **Storage file bytes** — database dumps contain Storage metadata, not the uploaded objects themselves. Copy every bucket/object separately and retain the bucket/object inventory.
3. **Authentication/configuration inventory** — document OAuth providers, redirect URLs, SMTP settings, custom domains, Edge Functions, secrets names (not secret values), and DNS/deployment settings. Reconfigure secrets securely; do not place secrets in the backup repository.
4. **Website source and deployment configuration** — preserve the current GitHub default branch and deployment history. Keep the proposed CRM changes in a separate branch/PR.
5. **Evidence** — record UTC timestamp, project ref, CLI version, file sizes, SHA-256 checksums, table counts, bucket/object counts, and restore-test result.

## Step 1 — prepare a private backup directory

On a trusted computer with Docker and Supabase CLI available:

```bash
mkdir -p adamarket-backup-$(date -u +%Y%m%dT%H%M%SZ)
cd adamarket-backup-*
umask 077
npx supabase --version
```

Obtain the database connection string from the Supabase Dashboard's **Connect** panel. Use it locally only; do not paste it into chat or save it in GitHub. Prefer a temporary shell environment variable and clear it after use.

```bash
export DATABASE_URL='PASTE_CONNECTION_STRING_LOCALLY_ONLY'
```

## Step 2 — export database

Use a recent Supabase CLI and Docker:

```bash
npx supabase db dump --db-url "$DATABASE_URL" -f roles.sql --role-only
npx supabase db dump --db-url "$DATABASE_URL" -f schema.sql
npx supabase db dump --db-url "$DATABASE_URL" -f data.sql --use-copy --data-only
```

If any command fails, stop. Do not proceed to replacement. Keep the error log private and resolve the cause before retrying.

## Step 3 — verify the export files

```bash
test -s roles.sql && test -s schema.sql && test -s data.sql
wc -c roles.sql schema.sql data.sql
sha256sum roles.sql schema.sql data.sql > SHA256SUMS
sha256sum -c SHA256SUMS
```

A checksum proves file integrity only; it does **not** prove the dump can be restored.

## Step 4 — preserve Storage object bytes separately

In Supabase Dashboard → Storage, record each bucket and its object count. Download/copy the actual objects from every bucket to a separate private backup location, preserving object paths and filenames. Confirm the local object count and total bytes match the source inventory. Do not assume a database dump includes file bytes. The production project currently has Storage objects, so this step cannot be skipped.

## Step 5 — restore test before declaring the backup valid

Restore the SQL files into a disposable local/test Postgres/Supabase environment—not production. Compare:
- required schemas, tables, indexes, functions, triggers and RLS policies;
- row counts for all application tables, including `auth.users`;
- relationships and key constraints;
- Storage bucket/object inventory and sample files opened successfully;
- sign-in configuration checklist and Edge Function source inventory.

If restore fails or counts differ unexpectedly, mark the backup **FAILED** and do not delete or replace production.

## Step 6 — recovery evidence

Create a private manifest with:
- UTC backup time and project ref;
- CLI and Postgres versions;
- SHA-256 checksums and byte sizes;
- table row counts before and after restore;
- bucket names, object counts and total bytes;
- restore test date, tester and result;
- location of the private backup copy.

Keep at least one additional copy outside the same account/device. Do not commit SQL data dumps or user files to the public repository.

## Explicit release gate

Production replacement may be discussed only after the owner confirms:
- the database dump exists and checksum verification passed;
- Storage object files are separately backed up;
- the restore test passed;
- backup files are accessible from a separate location;
- the exact data to preserve versus retire has been listed;
- the replacement deployment and rollback plan are approved.

No production changes are authorized by this runbook.
