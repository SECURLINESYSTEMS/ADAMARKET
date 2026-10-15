# ADAMARKET CRM SaaS rebuild

## Product direction

Replace the marketplace user experience with a simple, mobile-first CRM for small service businesses. The marketplace is no longer the product direction. Do not connect an ADAMARKET Telegram bot.

## Safety boundaries

- Build and review changes on `crm-saas-rebuild`; do not publish directly to production.
- Do not drop or truncate existing Supabase tables during the UI rebuild.
- Do not remove Supabase Auth users, provider settings, storage buckets, or secrets as part of replacing the frontend.
- The existing `crm_leads`, `crm_deals`, `crm_tasks`, and `crm_activities` tables are a starting point, not proof of a production-ready multi-tenant CRM.
- Before connecting real customer data, add and test tenant/company ownership, membership roles, and row-level security policies. Every query must be scoped to the authenticated user's company.
- Never put a Supabase service-role key in browser code.

## User-first MVP

1. **Overview:** today's tasks, open requests, overdue items, recent activity, and one prominent “New request” action.
2. **Requests / jobs:** create, search, filter, assign a responsible person, set a status, and view the full history.
3. **Clients:** one contact record with phone, company, notes, and all related requests.
4. **Tasks:** due date, priority, responsible person, completion, and links to a client/request.
5. **Deals:** stages, amount, expected close date, and a simple pipeline.
6. **Team and roles:** owner, manager, and employee permissions; invite flow only after RLS is verified.
7. **Settings:** company profile, language, timezone, and data export.

## UX principles

- Russian-first interface with Uzbek-ready text structure.
- Mobile-first layout, large tap targets, readable status labels, and short forms.
- Avoid unnecessary steps: create a request in one form, offer phone links on mobile, and keep search and filters visible.
- Empty states should explain the next action. Show clear save/error feedback and loading states.
- Use realistic demo data only in a clearly labeled prototype. Never imply demo data is connected to production.

## Implementation sequence

### Phase A — inspect and isolate
- Map the current routes, deployment workflow, environment variables, auth redirects, and Supabase dependencies.
- Keep the existing marketplace deployment untouched while working in this branch.
- Confirm the current production host and deployment source before changing the root page.

### Phase B — secure data model
- Introduce a `companies` table and `company_members` membership table.
- Add `company_id` to CRM records and define foreign keys/indexes.
- Write RLS policies for tenant isolation and roles; verify cross-company reads and writes are denied.
- Add audit events for important changes and avoid exposing sensitive customer fields unnecessarily.
- Prepare a tested migration and recovery procedure before applying schema changes to production.

### Phase C — connect the UI
- Use the existing Supabase client configuration and current auth flow only after inspecting the code.
- Replace demo arrays with authenticated queries and mutations.
- Add validation, loading/error states, empty states, pagination, and CSV export.
- Keep credentials server-side; do not add a Telegram bot.

### Phase D — verify before release
- Test sign-in/sign-out, mobile navigation, CRUD, search, filters, task completion, CSV export, and session expiry.
- Test role permissions and cross-tenant isolation with separate test accounts.
- Run project checks and inspect the production build.
- Deploy only after review and explicit confirmation.

## Acceptance checklist

- [ ] A user can create, find, edit, and complete a request on mobile.
- [ ] A client profile shows related requests and tasks.
- [ ] Changes survive refresh and another authenticated session.
- [ ] Data is isolated by company and role.
- [ ] Empty, loading, and error states are understandable.
- [ ] CSV export opens correctly in common spreadsheet software.
- [ ] No marketplace navigation or ADAMARKET Telegram bot is included in the CRM UX.
- [ ] Production has not been changed until tests and release approval are complete.
