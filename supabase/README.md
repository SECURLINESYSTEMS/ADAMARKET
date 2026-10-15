# CRM SaaS — isolated local Supabase development

This directory is a **local-only development scaffold** for the planned CRM SaaS. It is not connected to ADAMARKET production and must not be linked to the production Supabase project.

## What the technical foundation includes

- Multi-company accounts with owner/admin/member roles.
- Tenant isolation through row-level security (RLS).
- Employee access limited to requests, tasks and deals assigned to them.
- Customer records visible to managers and to employees through their assigned work.
- Request/work-item lifecycle, task ownership and activity history.
- Deal pipelines with configurable stages, amounts, currency and expected close dates.
- Organization-defined custom fields for customers, requests and deals.
- Company-level industry, currency, timezone, locale and settings.
- Single-use, seven-day email/phone invitations bound to the invitee's confirmed Supabase identity; automatic email/SMS delivery is not yet wired.
- Industry modules selected per company, so the same core can be configured for service/installation, sales, beauty, real estate, education, construction, logistics, retail or professional services.
- Secure organization onboarding that creates the owner membership and a default sales pipeline.
- RLS helper functions kept in the non-exposed `crm_saas_private` schema. Only the intentional onboarding RPC is exposed in `crm_saas`.

This is a backend foundation, not yet a complete production application. The frontend, invitations/team management, file upload, audit completeness, recovery rehearsal and end-to-end user flows still need implementation and verification.

## Requirements

- A computer running Windows, macOS, or Linux
- Node.js 20+ (if using the npm CLI)
- Docker Desktop or another Docker-compatible container runtime
- Supabase CLI

## Start locally

From the repository root:

```bash
npx supabase start
npx supabase test db
```

The first start downloads container images and can take several minutes. The CLI prints local URLs and credentials. Supabase Studio is normally available at `http://127.0.0.1:54323`.

To stop the local stack without deleting its data:

```bash
npx supabase stop
```

## Automated security tests

The pgTAP test suite in `supabase/tests/crm_saas_security.test.sql` uses synthetic users and companies. It checks:
- employees can see only assigned work, related customers, tasks and deals;
- cross-company records are hidden;
- employees can create work assigned to themselves and register customers;
- employees cannot assign work or tasks to coworkers;
- an authenticated user can create a company through the onboarding function;
- invitations are single-use and cannot be claimed by another account;
- onboarding creates the owner membership, default pipeline and stages;
- employees cannot promote themselves to owner.

GitHub Actions is configured to run the local Supabase migration/test flow on pushes to the isolated branch and pull requests. A test is not considered passed until the workflow result is green.

## Safety rules

- Do not run `supabase link` against the production ADAMARKET project.
- Do not run `supabase db push` against any hosted project for this scaffold.
- Never commit production credentials, service-role keys, access tokens, or real customer data.
- Use synthetic test users and data only.
- The migrations are drafts until they pass the local CI workflow and receive review.
- Production deployment requires a separate explicit approval.

## Data model

The `crm_saas` schema is separate from ADAMARKET's existing `public` tables. It is intended to support organizations, members, customers, work items, tasks, activity log, pipelines, stages, deals, custom fields and per-organization industry modules. Existing marketplace tables, Auth users, storage buckets and data are not removed or modified by this scaffold.

## Production readiness gates

Before connecting real customer data:
1. Confirm all local migrations and pgTAP tests pass.
2. Complete UI/Auth integration and test owner, admin and employee flows end-to-end.
3. Add reviewed team invitation and membership lifecycle flows.
4. Run Supabase security/performance advisors against the isolated test environment and resolve all CRM-specific findings.
5. Verify backup/restore for the existing project and rehearse a rollback.
6. Obtain explicit approval for any production migration or cutover.
