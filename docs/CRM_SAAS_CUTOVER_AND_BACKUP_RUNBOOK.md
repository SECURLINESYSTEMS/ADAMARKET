# ADAMARKET → CRM SaaS: backup, recovery, and cutover runbook

**Status: planning only. No production data, DNS, auth settings, storage objects, or deployments have been changed.**

## Goal

Replace the public ADAMARKET marketplace experience with the new multi-tenant CRM SaaS only after the CRM has been built and tested in an isolated environment and a recoverable backup has been verified.

## Current production inventory (2026-10-15)

Project ref: `nmskpqugwiwdcukqckcy`  
Region: `ap-southeast-2`  
Database engine: PostgreSQL 17  
Project status at inventory: `ACTIVE_HEALTHY`

Initial inventory observed:
- 26 tables in `public`
- 9 records in `auth.users`
- Marketplace tables and data, payment/subscription records, partner requests, BeautyUz tables, and existing CRM tables are present.
- The existing CRM tables (`crm_leads`, `crm_deals`, `crm_tasks`, `crm_activities`) were empty at the prior row-count check; this does not mean the rest of the project is disposable.
- Storage buckets/objects, edge functions, auth provider configuration, DNS and deployment settings have not yet been fully inventoried.
- No Supabase development branch exists. The CRM foundation scaffold is in GitHub branch `crm-saas-local-foundation` and draft PR #12; it has not been deployed or validated against production.

These are point-in-time observations, not a verified backup.

## Read-only production inventory refresh (2026-10-16)

This refresh used read-only Supabase project inspection and SQL. It did not modify production.

- Project status: `ACTIVE_HEALTHY`; PostgreSQL 17.6.1; region `ap-southeast-2`.
- Current counts at inspection time: **26 public base tables**, **9 Auth users**, **2 Storage buckets**, **15 Storage objects**. Counts are point-in-time inventory only, not backup evidence.
- Storage buckets: `ad-images` (public), `adamarket` (public). Both bucket contents must be exported and checksummed independently from database rows; object-level policy/access behavior must be recorded.
- Public tables include marketplace listings/ads, profiles, bookings, favorites, offers, partner requests, payments, plans, subscriptions, wallet transactions, BeautyUz tables, and existing `crm_*` tables. Preserve the entire project; do not assume unused or empty tables are disposable.
- Applied migration history currently includes marketplace, booking, billing, Storage, and security-hardening migrations through `20261010101949`. Export the complete migration history and schema before planning any replacement.
- Active Edge Functions observed: `telegram-adamarket`, `adamarket-api`, `adamarket-web-api`, `devsms-send-sms`. The owner has said ADAMARKET should no longer use its Telegram bot. Keep this function in the backup inventory; do not disable or delete it until backup/restore is verified and a separate cleanup/cutover step is approved.
- Supabase security advisor rechecked at **2026-10-16 05:03 UTC** still reports **five warnings** for authenticated execution of SECURITY DEFINER functions (`create_booking`, `create_secure_booking`, `get_ad_place_contact`, `is_current_user_admin`, `spend_balance`) and **one warning** that leaked-password protection is disabled. The warning is not proof of exploitability; review each function body, grants, and intended caller before changing permissions. No production permission or Auth changes were made.
- A fresh read-only table inventory again returned **26 public tables**, and the advisor response confirms the same five function warnings. The table listing showed RLS enabled on all 26 listed public tables; this does not by itself prove that each policy is correct or safe.

### Inventory completion status

- [x] Read-only snapshot of project health, database engine/region, migration history, public table count, Auth user count, Storage bucket/object counts, active Edge Functions, and current security-advisor warnings.
- [ ] Export database schema, data, roles/grants, policies, functions, triggers, and migration history to controlled storage.
- [ ] Export the actual Storage object bytes and checksums.
- [ ] Capture Auth/provider/redirect/SMTP and deployment/DNS configuration inventory without writing secret values to GitHub.
- [ ] Restore the exports to an isolated target and validate counts, access rules, object availability, and application smoke tests.

## Non-negotiable safety gates

1. Do not run destructive SQL, truncate/drop tables, delete Auth users or Storage objects, change DNS, or deploy a new production build during preparation.
2. Keep CRM development isolated. Do not link the local scaffold to production and do not run `supabase db push` against the hosted ADAMARKET project.
3. Never place production secrets, service-role keys, access tokens, or real customer records in GitHub.
4. Keep an immutable copy of the current website source and record the deployed commit before cutover.
5. Do not treat a Git repository backup as a database backup. Do not treat database schema export as a data-and-storage backup.
6. A backup is not verified until a restore to an isolated target succeeds and the restored data is checked.

## Backup work checklist

### A. Website / GitHub
- [ ] Record repository default branch, deployed commit SHA, build command, output directory, hosting provider and environment-variable names (not values).
- [ ] Create a tagged or otherwise immutable reference to the current production source commit.
- [ ] Preserve current routing, assets, robots.txt, sitemap, manifest and APK build inputs.
- [ ] Export deployment configuration where the host supports it; separately document DNS records and domain ownership settings.

### B. Supabase database
- [ ] In Supabase Dashboard, inspect Database → Backups and record available backup timestamps and retention. Managed database backups do **not** include the actual Storage object bytes.
- [ ] Determine whether the project exposes downloadable backups or uses physical backups/PITR. Do not assume a dashboard backup is a portable SQL file.
- [ ] On a trusted workstation with the current Supabase CLI and PostgreSQL client installed, create a new backup directory **outside the Git repository** with restricted filesystem permissions. Read the current CLI help before running commands.
- [ ] Obtain the source connection string privately from Supabase Dashboard → Connect. Set it in a local shell variable such as `SOURCE_DB_URL`; never paste the real value into chat, GitHub, issue comments, terminal transcripts, or committed scripts.
- [ ] Using the current Supabase backup guide, export roles, schema and data as separate files. The documented CLI command shapes are:

  ```sh
  supabase db dump --db-url "$SOURCE_DB_URL" -f roles.sql --role-only
  supabase db dump --db-url "$SOURCE_DB_URL" -f schema.sql
  supabase db dump --db-url "$SOURCE_DB_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
  ```

  Run these from the protected backup directory; adapt exclusions only after reviewing the installed CLI help and the source schema. Do not upload these dumps to this repository because they may contain private customer data.
- [ ] Preserve migration history (`supabase_migrations` schema and data) separately as described in the official backup guide, and record extension/settings requirements. Review whether custom objects exist in `auth` or `storage` that need a separate schema/policy export.
- [ ] Capture table counts and referential-integrity checks before restore; compare them after restore.
- [ ] Never export or expose password hashes, auth tokens, database passwords, or other secrets in logs or reports.

Official procedure: [Supabase backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

### C. Auth and Storage
- [ ] Inventory auth providers, redirect URLs, SMTP configuration, auth templates and relevant project settings. Store secret values only in an approved secret manager, if a secure export is supported.
- [ ] Inventory both known public buckets (`ad-images`, `adamarket`), list every object path/size/content type, and export the actual object bytes to the protected backup directory. A Postgres dump alone does not preserve Storage binary contents.
- [ ] Use the installed CLI's `supabase storage --help` / `supabase storage cp --help` to verify the current supported copy syntax before bulk export; do not guess flags or place credentials in command history.
- [ ] Generate a SHA-256 checksum manifest for the exported files and compare it with a post-copy verification pass. Preserve the object path-to-checksum mapping and bucket settings.
- [ ] Record Storage policies and bucket settings. Official reference: [Supabase Storage object downloads](https://supabase.com/docs/guides/storage/management/download-objects).
- [ ] Confirm how Auth identities and sessions behave when restored; do not assume a database restore alone makes every login/session configuration recoverable.

### D. Restore rehearsal
- [ ] Restore the database backup to a separate local/test project, never over production.
- [ ] Restore representative Storage objects and confirm access policies.
- [ ] Compare schema/table counts, row counts, key relationships, functions, triggers, RLS policies and storage object counts.
- [ ] Smoke-test sign-in flows only in the isolated environment with test accounts.
- [ ] Record restore time, errors, missing components and the exact steps needed to recover.

**Backup acceptance criterion:** all critical components have a documented copy, and database plus Storage restore checks pass in isolation. If a component cannot be restored, state that explicitly and do not claim the backup is complete.

## CRM readiness gates before cutover

- [ ] Build CRM in a local/test environment, separate from production.
- [ ] Test organization isolation, member assignment permissions, RLS and role escalation resistance with multiple synthetic tenants and users.
- [ ] Add secure organization creation, invitation/onboarding, membership management, account recovery and owner/admin workflows.
- [ ] Test customer, work-item, task, activity log, module settings, file upload and audit trail flows.
- [ ] Add automated tests for tenant data leakage, unassigned work items, cross-tenant foreign keys, unauthorized updates/deletes, and admin/owner boundaries.
- [ ] Configure and test billing only if the initial product scope requires it.
- [ ] Complete mobile and desktop QA, accessibility, performance, error states, logging and monitoring.
- [ ] Decide whether the same domain will host CRM at root or whether a subdomain is preferable. Do not change DNS before approval and a rollback plan.
- [ ] Prepare a production migration plan, deployment plan and tested rollback plan.
- [ ] Obtain explicit go-ahead for the exact cutover window and list of production changes.

## Cutover / rollback (future; not authorized now)

1. Announce a short write freeze if required and capture final pre-cutover backup.
2. Deploy the reviewed CRM build and database migrations only after all readiness gates pass.
3. Run smoke tests and monitor auth, database, storage and application errors.
4. If any critical check fails, restore the prior website deployment and revert DNS/configuration as applicable. Restore data only using the rehearsed recovery procedure; avoid ad-hoc destructive SQL.
5. Keep the marketplace backup intact until CRM operation is stable and a retention period has passed.

## Current status

Preparation only. No production changes or deletions have been made. The next concrete action is to inspect the provider's backup/restore capabilities, then build and test the CRM in isolation.
