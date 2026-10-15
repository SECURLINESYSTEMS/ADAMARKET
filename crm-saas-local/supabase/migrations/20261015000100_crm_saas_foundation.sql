-- CRM SaaS foundation draft.
-- This migration is intended for LOCAL Supabase only.
-- Do not link this scaffold to ADAMARKET production or run db push against a hosted project.

create schema if not exists crm_saas;

create type crm_saas.organization_role as enum ('owner', 'admin', 'member');
create type crm_saas.work_item_status as enum ('new', 'in_progress', 'waiting', 'completed', 'cancelled');
create type crm_saas.task_status as enum ('open', 'in_progress', 'done', 'cancelled');

-- Keep RLS helper functions out of PostgREST's exposed API schemas.
create schema if not exists crm_saas_private;
revoke all on schema crm_saas_private from public, anon;
grant usage on schema crm_saas_private to authenticated;

create table crm_saas.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table crm_saas.organization_members (
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role crm_saas.organization_role not null default 'member',
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table crm_saas.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 200),
  phone text,
  email text,
  company_name text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table crm_saas.work_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  customer_id uuid,
  title text not null check (length(trim(title)) between 1 and 240),
  description text,
  status crm_saas.work_item_status not null default 'new',
  priority smallint not null default 3 check (priority between 1 and 5),
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, customer_id)
    references crm_saas.customers(organization_id, id) on delete set null (customer_id)
);

create table crm_saas.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  work_item_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 240),
  status crm_saas.task_status not null default 'open',
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, work_item_id)
    references crm_saas.work_items(organization_id, id) on delete cascade
);

create table crm_saas.activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  work_item_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  activity_type text not null check (length(trim(activity_type)) between 1 and 80),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, work_item_id)
    references crm_saas.work_items(organization_id, id) on delete cascade
);

create table crm_saas.industry_modules (
  code text primary key check (code ~ '^[a-z][a-z0-9_-]{1,62}$'),
  name text not null,
  description text,
  is_available boolean not null default false,
  created_at timestamptz not null default now()
);

create table crm_saas.organization_modules (
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  module_code text not null references crm_saas.industry_modules(code) on delete restrict,
  enabled boolean not null default true,
  enabled_at timestamptz not null default now(),
  primary key (organization_id, module_code)
);

create index organization_members_user_active_idx
  on crm_saas.organization_members (user_id, organization_id) where is_active;
create index customers_org_created_idx
  on crm_saas.customers (organization_id, created_at desc);
create index work_items_org_status_idx
  on crm_saas.work_items (organization_id, status, created_at desc);
create index work_items_assignee_idx
  on crm_saas.work_items (organization_id, assigned_to, status);
create index work_items_customer_idx
  on crm_saas.work_items (organization_id, customer_id);
create index tasks_org_assignee_status_idx
  on crm_saas.tasks (organization_id, assigned_to, status);
create index activity_log_org_item_created_idx
  on crm_saas.activity_log (organization_id, work_item_id, created_at desc);

-- SECURITY DEFINER helpers avoid recursive RLS when checking membership.
-- Fixed search_path and schema-qualified object references are deliberate.
create or replace function crm_saas_private.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from crm_saas.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.is_active
  );
$$;

create or replace function crm_saas_private.has_org_role(target_org uuid, allowed_roles crm_saas.organization_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from crm_saas.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.is_active
      and m.role = any(allowed_roles)
  );
$$;

create or replace function crm_saas_private.can_access_work_item(target_org uuid, target_item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from crm_saas.work_items w
    where w.organization_id = target_org
      and w.id = target_item
      and crm_saas_private.is_org_member(w.organization_id)
      and (
        crm_saas_private.has_org_role(w.organization_id, array['owner','admin']::crm_saas.organization_role[])
        or w.assigned_to = (select auth.uid())
      )
  );
$$;

revoke all on function crm_saas_private.is_org_member(uuid) from public;
revoke all on function crm_saas_private.has_org_role(uuid, crm_saas.organization_role[]) from public;
revoke all on function crm_saas_private.can_access_work_item(uuid, uuid) from public;
grant execute on function crm_saas_private.is_org_member(uuid) to authenticated;
grant execute on function crm_saas_private.has_org_role(uuid, crm_saas.organization_role[]) to authenticated;
grant execute on function crm_saas_private.can_access_work_item(uuid, uuid) to authenticated;

alter table crm_saas.organizations enable row level security;
alter table crm_saas.organization_members enable row level security;
alter table crm_saas.customers enable row level security;
alter table crm_saas.work_items enable row level security;
alter table crm_saas.tasks enable row level security;
alter table crm_saas.activity_log enable row level security;
alter table crm_saas.industry_modules enable row level security;
alter table crm_saas.organization_modules enable row level security;

-- The schema is exposed through the local API, but row access remains controlled by RLS.
grant usage on schema crm_saas to authenticated;
grant select, update on crm_saas.organizations to authenticated;
grant select on crm_saas.organization_members to authenticated;
grant select, insert, update on crm_saas.customers to authenticated;
grant select, insert, update on crm_saas.work_items to authenticated;
grant select, insert, update on crm_saas.tasks to authenticated;
grant select, insert on crm_saas.activity_log to authenticated;
grant select on crm_saas.industry_modules to authenticated;
grant select, insert, update on crm_saas.organization_modules to authenticated;

create policy organizations_read_member
on crm_saas.organizations for select to authenticated
using (crm_saas_private.is_org_member(id));

create policy organizations_update_admin
on crm_saas.organizations for update to authenticated
using (crm_saas_private.has_org_role(id, array['owner','admin']::crm_saas.organization_role[]))
with check (crm_saas_private.has_org_role(id, array['owner','admin']::crm_saas.organization_role[]));

create policy organization_members_read_self_or_admin
on crm_saas.organization_members for select to authenticated
using (
  user_id = (select auth.uid())
  or crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
);

-- Membership writes are intentionally not exposed to client roles yet.
-- Add a reviewed server-side invite/onboarding flow before enabling them.

create policy customers_read_by_work_assignment
on crm_saas.customers for select to authenticated
using (
  crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
  or (
    crm_saas_private.is_org_member(organization_id)
    and exists (
      select 1 from crm_saas.work_items w
      where w.organization_id = customers.organization_id
        and w.customer_id = customers.id
        and w.assigned_to = (select auth.uid())
    )
  )
);

create policy customers_admin_insert
on crm_saas.customers for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
);

create policy customers_admin_update
on crm_saas.customers for update to authenticated
using (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]))
with check (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]));

create policy work_items_read_assigned_or_admin
on crm_saas.work_items for select to authenticated
using (
  crm_saas_private.is_org_member(organization_id)
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
);

create policy work_items_admin_insert
on crm_saas.work_items for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
);

create policy work_items_update_assigned_or_admin
on crm_saas.work_items for update to authenticated
using (
  crm_saas_private.is_org_member(organization_id)
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
)
with check (
  crm_saas_private.is_org_member(organization_id)
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or (
      assigned_to = (select auth.uid())
      and assigned_to = (select auth.uid())
    )
  )
);

create policy tasks_read_accessible_item
on crm_saas.tasks for select to authenticated
using (crm_saas_private.can_access_work_item(organization_id, work_item_id));

create policy tasks_admin_insert
on crm_saas.tasks for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
  and crm_saas_private.can_access_work_item(organization_id, work_item_id)
);

create policy tasks_update_accessible_item
on crm_saas.tasks for update to authenticated
using (crm_saas_private.can_access_work_item(organization_id, work_item_id))
with check (crm_saas_private.can_access_work_item(organization_id, work_item_id));

create policy activity_read_accessible_item
on crm_saas.activity_log for select to authenticated
using (crm_saas_private.can_access_work_item(organization_id, work_item_id));

create policy activity_insert_accessible_item
on crm_saas.activity_log for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and crm_saas_private.can_access_work_item(organization_id, work_item_id)
);

create policy industry_modules_read_available
on crm_saas.industry_modules for select to authenticated
using (is_available = true);

create policy organization_modules_read_member
on crm_saas.organization_modules for select to authenticated
using (crm_saas_private.is_org_member(organization_id));

create policy organization_modules_admin_manage
on crm_saas.organization_modules for all to authenticated
using (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]))
with check (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]));

-- Intentionally no client-side organization creation, membership escalation, or deletes yet.
-- Those flows should be implemented via a reviewed server-side onboarding function.
