-- ADAMARKET CRM: contacts/leads, sales pipeline, tasks and activity history.
-- Access is restricted to authenticated administrators through private.is_admin().
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  company_name text,
  source text not null default 'Сайт',
  interest text,
  status text not null default 'new' check (status in ('new','contacted','qualified','proposal','won','lost')),
  estimated_value numeric(14,2) not null default 0 check (estimated_value >= 0),
  next_follow_up_at timestamptz,
  notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_leads_contact_present check (
    coalesce(nullif(trim(phone),''),'') <> '' or coalesce(nullif(trim(email),''),'') <> ''
  )
);
create table if not exists public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete set null,
  title text not null,
  stage text not null default 'qualification' check (stage in ('qualification','proposal','negotiation','won','lost')),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  expected_close_date date,
  lost_reason text,
  notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  lead_id uuid references public.crm_leads(id) on delete set null,
  deal_id uuid references public.crm_deals(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete cascade,
  deal_id uuid references public.crm_deals(id) on delete cascade,
  task_id uuid references public.crm_tasks(id) on delete set null,
  activity_type text not null default 'note' check (activity_type in ('call','email','meeting','note','status_change')),
  summary text not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists crm_leads_status_created_idx on public.crm_leads(status, created_at desc);
create index if not exists crm_leads_follow_up_idx on public.crm_leads(next_follow_up_at) where next_follow_up_at is not null;
create index if not exists crm_deals_stage_idx on public.crm_deals(stage, updated_at desc);
create index if not exists crm_tasks_status_due_idx on public.crm_tasks(status, due_at);
create index if not exists crm_activities_lead_created_idx on public.crm_activities(lead_id, created_at desc);
create index if not exists crm_activities_deal_created_idx on public.crm_activities(deal_id, created_at desc);

alter table public.crm_leads enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_activities enable row level security;

revoke all on public.crm_leads, public.crm_deals, public.crm_tasks, public.crm_activities from public, anon;
grant select, insert, update, delete on public.crm_leads, public.crm_deals, public.crm_tasks, public.crm_activities to authenticated;

drop policy if exists crm_leads_admin_all on public.crm_leads;
create policy crm_leads_admin_all on public.crm_leads for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists crm_deals_admin_all on public.crm_deals;
create policy crm_deals_admin_all on public.crm_deals for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists crm_tasks_admin_all on public.crm_tasks;
create policy crm_tasks_admin_all on public.crm_tasks for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists crm_activities_admin_all on public.crm_activities;
create policy crm_activities_admin_all on public.crm_activities for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
