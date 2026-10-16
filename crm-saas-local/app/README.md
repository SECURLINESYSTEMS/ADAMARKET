# CRM SaaS — isolated functional prototype

This CRM is developed on the `crm-saas-local-foundation` branch and is not connected to the hosted ADAMARKET production project. The responsive browser interface is intended for isolated testing and must not be published as the production site until the backup, recovery, security, and cutover gates are completed.

## Run locally

1. From the repository root, start the isolated Supabase stack and apply local migrations:

   ```bash
   cd crm-saas-local
   npx supabase start
   npx supabase db reset
   ```

2. Copy the **publishable** key printed by `npx supabase status`. Open `app/config.js` and set `publishableKey`. The default URL is `http://127.0.0.1:54321`.

   Use only a publishable/anon key in browser configuration. Never place a service-role key in the client or commit secrets to GitHub.

3. From the repository root, serve the static client:

   ```bash
   python -m http.server 3000 --directory crm-saas-local/app
   ```

4. Open `http://127.0.0.1:3000`. For local email magic links, open Mailpit at `http://127.0.0.1:54324`.

5. Run browser/client contract tests from the repository root:

   ```bash
   node --test crm-saas-local/tests/client-contract.test.mjs
   ```

6. Run database security tests:

   ```bash
   cd crm-saas-local
   npx supabase test db
   ```

7. The browser end-to-end test additionally requires the local Supabase stack, Mailpit, Playwright/Chromium, and the local HTTP server. GitHub Actions configures these in `.github/workflows/crm-saas-db-tests.yml`.

## Implemented workflows

- Email magic-link sign-in, phone OTP, and Google OAuth entry points. Phone and Google providers must be configured in the isolated Auth environment.
- Company creation and selection; company currency, language, timezone, and settings.
- Responsive section navigation and separate dashboard metrics for clients, open requests, unfinished tasks, overdue work, and active deal value.
- Create, list, edit, archive, and restore customers, work items, tasks, and deals.
- Search within the selected company and export customers, requests, tasks, and deals as CSV. CSV export protects against spreadsheet formula injection.
- Profession-specific custom fields for text, number, date, boolean, URL, select, and multiselect values; values are stored in entity JSON metadata.
- Work-item status, task status, deal stage, pipelines, and team membership controls.
- Team invitations by confirmed email or phone, invitation-link copying, role changes, and member activation controls.
- Private work-item attachments: upload up to 20 MB, open through short-lived signed URLs, and remove subject to access checks.
- Starter custom fields for a company's selected profession and activity history for supported work-item events.

## Latest verification

For branch commit `3bbfb2f0b73a423cf3ffd7eaef5e5b92443b85e8` (2026-10-16), both GitHub Actions workflows completed successfully:

- **Validate ADAMARKET** — passed.
- **CRM SaaS database tests** — passed on the local isolated Supabase stack, including the SQL security suite and browser end-to-end workflow.

The latest run (`38852971036`) passed on the disposable local Supabase stack, including migration reset, pgTAP security tests, and the authenticated Playwright browser end-to-end flow. These checks validate the tested branch and isolated test environment only. They do not certify production readiness or prove that a production backup can be restored.

## Outstanding limitations and release gates

- Invitation links can be copied, but automatic email/SMS delivery is not implemented.
- Expand end-to-end coverage for invitations, role changes, and cross-tenant attack scenarios before production approval.
- The production database, Auth configuration, Storage objects, DNS, and deployment have not been migrated or changed by this branch.
- Production backup and restore rehearsal remains outstanding. A backup is not considered verified until database schema/data, Storage object bytes, relevant configuration inventory, and checksums have been preserved and a restore to an isolated target has succeeded.
- Do not link this local scaffold to the hosted ADAMARKET Supabase project or run `supabase db push` against production.
- Do not merge the cutover or deploy the CRM to production until the backup and restore checks pass and cutover is separately approved.
