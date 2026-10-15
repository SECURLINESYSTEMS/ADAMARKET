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
- Company creation and selection.
- Create/list customers, work items, tasks and deals.
- Update work-item status, task status and deal stage.
- Team invitations by confirmed email or phone, invitation-link copying, role changes and member activation controls.
- Custom fields and JSON metadata for profession-specific data.
- Activity entries when work items are created or their status changes.

## Current limitations

- The app intentionally has no visual design system; that work comes after the technical flows are verified.
- Invitation links are generated but not sent automatically by email/SMS.
- The client only uses public Auth credentials and relies on database RLS/RPC checks for authorization. The frontend is not a security boundary.
- File uploads, full edit/delete flows for every entity, complete audit coverage, production deployment and end-to-end tests remain outstanding.
