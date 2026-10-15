# CRM SaaS — functional prototype

This is an intentionally plain, unstyled browser client for exercising the CRM schema. It is not connected to the hosted ADAMARKET project and must not be published as a production site.

## Run locally

1. Start the isolated Supabase project from the repository root:

   ```bash
   cd crm-saas-local
   npx supabase start
   npx supabase db reset
   ```

2. Copy the **publishable** key printed by `npx supabase status`. Open `app/config.js` and set `publishableKey`. The default URL is `http://127.0.0.1:54321`.

   Only use a publishable/anon key in the browser. Never put a service-role key in this file.

3. In another terminal, serve the static app:

   ```bash
   python -m http.server 3000 --directory crm-saas-local/app
   ```

4. Open `http://127.0.0.1:3000`. Local email sign-in links are available in Mailpit at `http://127.0.0.1:54324`.

5. Run browser-to-schema contract checks from the repository root:

   ```bash
   node --test crm-saas-local/tests/client-contract.test.mjs
   ```

6. Run database security tests:

   ```bash
   cd crm-saas-local
   npx supabase test db
   ```

7. The end-to-end browser test requires the local Supabase stack, Mailpit, Playwright/Chromium and a local HTTP server. In CI these are configured by `.github/workflows/crm-saas-db-tests.yml`.

## Implemented browser workflows

- Email magic-link sign-in, phone OTP and Google OAuth entry points (phone and Google providers must be configured in the target Auth environment).
- Company creation, selection and settings (currency, language, timezone and JSON settings).
- Create/list, edit, archive and restore customers, work items, tasks and deals.
- Search across the current company's records, view operational summary metrics, and export customers/requests/tasks/deals as CSV.
- Configure profession-specific custom fields with text, number, date, boolean, URL and select/multiselect types; values are stored in each record's JSON metadata. Required single-select fields require an explicit selection.
- Update work-item status, task status and deal stage.
- Team invitations by confirmed email or phone, invitation-link copying, role changes and member activation controls.
- Private work-item attachments: upload up to 20 MB, open via short-lived signed URL, and remove with owner/manager checks.
- New companies receive starter custom fields for their chosen profession.
- Activity history, including entries when work items are created or their status changes.

## Verification status

The isolated GitHub Actions workflow has passed all eight CRM migrations, 40 pgTAP security assertions, browser JavaScript/schema contract checks, and the browser end-to-end flow for email magic-link authentication, company setup, customer/request/task/deal creation, CSV download, private attachment upload, and reversible customer archiving. Re-run the workflow after any subsequent changes; a previous pass is not a guarantee for future commits.

## Current limitations — not production-ready

- The app intentionally has no visual design system; UI/UX work follows the technical and security checks.
- Invitation links are generated and can be copied, but are **not automatically delivered by email/SMS**.
- The E2E test does not yet cover all invitation, role-management and cross-tenant attack scenarios; extend those checks before a production decision.
- Production deployment, provider configuration, backup/restore rehearsal and a separate approval remain outstanding.
- The client uses only public Auth credentials and relies on database RLS/RPC checks for authorization. The frontend is not a security boundary.
- Archiving is reversible and does not hard-delete records. Access to edits and archive operations is enforced by database RLS.
- Do not link this local scaffold to the hosted ADAMARKET Supabase project or run `db push` against production.
