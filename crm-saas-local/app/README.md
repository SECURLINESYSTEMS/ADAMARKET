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

5. To run database tests:

   ```bash
   cd crm-saas-local
   npx supabase test db
   ```

## Implemented browser workflows

- Email magic-link, phone OTP and Google OAuth entry points (the provider must be configured in local/hosted Auth settings).
- Company creation, selection and settings (currency, language, timezone and JSON settings).
- Create/list, edit, archive and restore customers, work items, tasks and deals.
- Search across the current company's records, see an operational summary, and export customers/requests/tasks/deals as CSV.
- Configure profession-specific custom fields with text, number, date, boolean, URL and select/multiselect types; values are stored in each record's JSON metadata.
- Update work-item status, task status and deal stage.
- Team invitations by confirmed email or phone, invitation-link copying, role changes and member activation controls.
- Custom fields and JSON metadata for profession-specific data.
- Activity history, with entries when work items are created or their status changes.

## Current limitations

- The app intentionally has no visual design system; that work comes after the technical flows are verified.
- Invitation links are generated but not sent automatically by email/SMS.
- The client only uses public Auth credentials and relies on database RLS/RPC checks for authorization. The frontend is not a security boundary.
- File uploads, automated invitation delivery, richer audit coverage, production deployment and browser end-to-end tests remain outstanding.
- Archiving is reversible and does not hard-delete records. Access to edits and archive operations remains enforced by database RLS.
