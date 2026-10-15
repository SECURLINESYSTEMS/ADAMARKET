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
- [ ] In Supabase Dashboard, inspect Database → Backups and record available backup timestamps and retention.
- [ ] Determine whether a downloadable backup includes database data, schema, roles/privileges and extensions, and whether point-in-time recovery is enabled for this plan.
- [ ] Create an independent logical export using the supported Supabase/Postgres backup route, covering required schemas and table data. Store it outside GitHub in access-controlled storage.
- [ ] Preserve migration history and a schema-only export.
- [ ] Capture table counts and relevant referential-integrity checks before any cutover.
- [ ] Never export or expose password hashes, auth tokens, or secrets in logs or reports.

### C. Auth and Storage
- [ ] Inventory auth providers, redirect URLs, SMTP configuration, auth templates and relevant project settings. Store secret values only in an approved secret manager, if a secure export is supported.
- [ ] Inventory Storage buckets and object counts; export the actual objects separately if needed. A Postgres dump alone does not preserve the binary contents of Storage.
- [ ] Record Storage policies and bucket settings.
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
