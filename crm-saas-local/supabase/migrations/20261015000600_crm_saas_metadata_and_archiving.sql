-- Complete metadata fields expected by the browser client and add reversible soft archiving.
-- This migration is isolated to the local CRM schema; it does not touch public marketplace tables.

alter table crm_saas.customers
  add column if not exists custom_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(custom_data) = 'object'),
  add column if not exists archived_at timestamptz;

alter table crm_saas.work_items
  add column if not exists custom_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(custom_data) = 'object'),
  add column if not exists archived_at timestamptz;

alter table crm_saas.tasks
  add column if not exists archived_at timestamptz;

alter table crm_saas.deals
  add column if not exists archived_at timestamptz;

create index if not exists customers_active_recent_idx
  on crm_saas.customers (organization_id, created_at desc)
  where archived_at is null;

create index if not exists work_items_active_recent_idx
  on crm_saas.work_items (organization_id, created_at desc)
  where archived_at is null;

create index if not exists tasks_active_due_idx
  on crm_saas.tasks (organization_id, due_at)
  where archived_at is null;

create index if not exists deals_active_recent_idx
  on crm_saas.deals (organization_id, updated_at desc)
  where archived_at is null;
