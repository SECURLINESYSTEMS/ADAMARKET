# CRM SaaS — local Supabase development

This directory is a **local-only development scaffold** for the planned CRM SaaS. It is not connected to ADAMARKET production and must not be linked to the production Supabase project.

## Requirements

- A computer running Windows, macOS, or Linux
- Node.js 20+ (if using the npm CLI)
- Docker Desktop or another Docker-compatible container runtime
- Supabase CLI

## Start locally

From the repository root:

```bash
npm install --save-dev supabase
npx supabase start
```

If the CLI is already installed in this repository, run only `npx supabase start`. Otherwise install it first with the commands above.

The first start downloads container images and can take several minutes. The CLI prints local URLs and credentials. Supabase Studio is normally available at `http://127.0.0.1:54323`.

To stop the local stack without deleting its data:

```bash
npx supabase stop
```

## Safety rules

- Do not run `supabase link` against the production ADAMARKET project.
- Do not run `supabase db push` against any hosted project for this scaffold.
- Never commit production credentials, service-role keys, access tokens, or real customer data.
- Use synthetic test users and data only.
- The migration here is a draft foundation and must be tested locally before any cloud deployment is considered.
- Production deployment requires a separate explicit approval.

## Initial migration

The first migration defines the logical multi-tenant CRM core and row-level security (RLS). It is intentionally separate from ADAMARKET's existing CRM tables and uses the `crm_saas` schema.

To reset the local database and reapply migrations only when you are comfortable losing local test data, use the Supabase CLI documentation first and make a backup if needed.
