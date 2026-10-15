-- Extend the isolated CRM SaaS foundation with configurable pipelines, deals,
-- custom fields and secure first-organization onboarding.
-- LOCAL/TEST ONLY. Do not apply to the hosted ADAMARKET project without review.

-- Available industry modules are data-driven so the same core CRM can serve
-- service businesses, sales teams, beauty, real estate, education, construction,
-- logistics, retail and professional services without separate codebases.
insert into crm_saas.industry_modules (code, name, description, is_available)
values
  ('core', 'Базовая CRM', 'Клиенты, заявки, задачи, история и сотрудники.', true),
  ('service_installation', 'Услуги и монтаж', 'Заявки, выезды, установка и обслуживание.', true),
  ('general_sales', 'Продажи', 'Воронка продаж, сделки, суммы и повторные контакты.', true),
  ('beauty', 'Красота и услуги', 'Клиенты и задачи для салонов и частных мастеров.', true),
  ('real_estate', 'Недвижимость', 'Клиенты, объекты в работе и сделки.', true),
  ('education', 'Обучение', 'Клиенты, заявки, группы и последующие действия.', true),
  ('construction', 'Строительство', 'Объекты, подрядчики, этапы и задачи.', true),
  ('logistics', 'Логистика', 'Клиенты, заявки на перевозку и исполнение.', true),
  ('retail', 'Торговля', 'Клиенты, продажи и повторные обращения.', true),
  ('professional_services', 'Профессиональные услуги', 'Гибкая CRM для компаний и специалистов.', true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_available = excluded.is_available;

alter table crm_saas.organizations
  add column if not exists industry_code text not null default 'professional_services'
    references crm_saas.industry_modules(code),
  add column if not exists default_currency text not null default 'UZS'
    check (default_currency ~ '^[A-Z]{3}
alter table crm_saas.customers
  add column if not exists custom_data jsonb not null default '{}'::jsonb
  check (jsonb_typeof(custom_data) = 'object');

alter table crm_saas.work_items
  add column if not exists custom_data jsonb not null default '{}'::jsonb
  check (jsonb_typeof(custom_data) = 'object');

alter table crm_saas.tasks
  add column if not exists description text,
  add column if not exists priority smallint not null default 3 check (priority between 1 and 5),
  add column if not exists completed_at timestamptz,
  add column if not exists custom_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(custom_data) = 'object');

create table crm_saas.pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  entity_type text not null default 'deal' check (entity_type in ('deal')),
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create unique index pipelines_one_default_per_org
  on crm_saas.pipelines (organization_id) where is_default;

create table crm_saas.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  pipeline_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 80),
  position integer not null check (position >= 0),
  probability smallint not null default 0 check (probability between 0 and 100),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, pipeline_id, id),
  unique (organization_id, pipeline_id, position),
  foreign key (organization_id, pipeline_id)
    references crm_saas.pipelines(organization_id, id) on delete cascade,
  check (not (is_won and is_lost))
);

create table crm_saas.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  pipeline_id uuid not null,
  stage_id uuid not null,
  customer_id uuid,
  title text not null check (length(trim(title)) between 1 and 240),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null default 'UZS' check (currency ~ '^[A-Z]{3}$'),
  assigned_to uuid,
  expected_close_date date,
  description text,
  custom_data jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_data) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, pipeline_id, stage_id)
    references crm_saas.pipeline_stages(organization_id, pipeline_id, id) on delete restrict,
  foreign key (organization_id, customer_id)
    references crm_saas.customers(organization_id, id) on delete set null (customer_id),
  foreign key (organization_id, assigned_to)
    references crm_saas.organization_members(organization_id, user_id) on delete set null (assigned_to)
);

create table crm_saas.custom_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('customer', 'work_item', 'deal')),
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  label text not null check (length(trim(label)) between 1 and 100),
  field_type text not null check (field_type in ('text', 'number', 'date', 'boolean', 'select', 'multiselect', 'url')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  is_required boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entity_type, field_key)
);

-- Keep update timestamps consistent regardless of which client updates a row.
create or replace function crm_saas_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $
begin
  new.updated_at := now();
  return new;
end;
$;

create trigger organizations_set_updated_at
before update on crm_saas.organizations
for each row execute function crm_saas_private.set_updated_at();
create trigger customers_set_updated_at
before update on crm_saas.customers
for each row execute function crm_saas_private.set_updated_at();
create trigger work_items_set_updated_at
before update on crm_saas.work_items
for each row execute function crm_saas_private.set_updated_at();
create trigger tasks_set_updated_at
before update on crm_saas.tasks
for each row execute function crm_saas_private.set_updated_at();
create trigger pipelines_set_updated_at
before update on crm_saas.pipelines
for each row execute function crm_saas_private.set_updated_at();
create trigger deals_set_updated_at
before update on crm_saas.deals
for each row execute function crm_saas_private.set_updated_at();
create trigger custom_fields_set_updated_at
before update on crm_saas.custom_fields
for each row execute function crm_saas_private.set_updated_at();

create index pipeline_stages_order_idx
  on crm_saas.pipeline_stages (organization_id, pipeline_id, position);
create index deals_org_stage_idx
  on crm_saas.deals (organization_id, pipeline_id, stage_id, updated_at desc);
create index deals_org_assignee_idx
  on crm_saas.deals (organization_id, assigned_to, updated_at desc);
create index deals_org_customer_idx
  on crm_saas.deals (organization_id, customer_id);
create index custom_fields_org_entity_idx
  on crm_saas.custom_fields (organization_id, entity_type, is_active);

alter table crm_saas.pipelines enable row level security;
alter table crm_saas.pipeline_stages enable row level security;
alter table crm_saas.deals enable row level security;
alter table crm_saas.custom_fields enable row level security;

grant select, insert, update on crm_saas.pipelines to authenticated;
grant select, insert, update on crm_saas.pipeline_stages to authenticated;
grant select, insert, update on crm_saas.deals to authenticated;
grant select, insert, update on crm_saas.custom_fields to authenticated;

-- A reusable active-membership check. It is intentionally narrowly scoped and
-- does not expose member lists or private organization data.
create or replace function crm_saas_private.is_active_org_member(target_org uuid, target_user uuid)
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
      and m.user_id = target_user
      and m.is_active
      and (
        target_user = (select auth.uid())
        or crm_saas_private.has_org_role(
          target_org,
          array['owner','admin']::crm_saas.organization_role[]
        )
      )
  );
$;

revoke all on function crm_saas_private.is_active_org_member(uuid, uuid) from public, anon;
grant execute on function crm_saas_private.is_active_org_member(uuid, uuid) to authenticated;

-- Replace the initial work-item write rules with member-aware rules. Employees
-- can create work assigned to themselves and edit only work assigned to them.
drop policy if exists work_items_admin_insert on crm_saas.work_items;
drop policy if exists work_items_update_assigned_or_admin on crm_saas.work_items;

create policy work_items_member_insert
on crm_saas.work_items for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
  )
);

create policy work_items_update_assigned_or_admin
on crm_saas.work_items for update to authenticated
using (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
)
with check (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
  )
);

-- Assigned employees may add tasks to their own work items; managers can assign
-- tasks to active members of the same organization.
drop policy if exists tasks_admin_insert on crm_saas.tasks;
create policy tasks_member_insert
on crm_saas.tasks for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas.can_access_work_item(organization_id, work_item_id)
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
  )
);

create policy pipelines_read_member
on crm_saas.pipelines for select to authenticated
using (crm_saas.is_org_member(organization_id));

create policy pipelines_insert_admin
on crm_saas.pipelines for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
);

create policy pipelines_update_admin
on crm_saas.pipelines for update to authenticated
using (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]))
with check (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]));

create policy pipeline_stages_read_member
on crm_saas.pipeline_stages for select to authenticated
using (crm_saas.is_org_member(organization_id));

create policy pipeline_stages_insert_admin
on crm_saas.pipeline_stages for insert to authenticated
with check (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]));

create policy pipeline_stages_update_admin
on crm_saas.pipeline_stages for update to authenticated
using (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]))
with check (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]));

create policy deals_read_assigned_or_admin
on crm_saas.deals for select to authenticated
using (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
);

create policy deals_insert_member
on crm_saas.deals for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and crm_saas_private.is_active_org_member(organization_id, assigned_to)
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
);

create policy deals_update_assigned_or_admin
on crm_saas.deals for update to authenticated
using (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
)
with check (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and crm_saas_private.is_active_org_member(organization_id, assigned_to)
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
);

create policy custom_fields_read_member
on crm_saas.custom_fields for select to authenticated
using (crm_saas.is_org_member(organization_id));

create policy custom_fields_insert_admin
on crm_saas.custom_fields for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
);

create policy custom_fields_update_admin
on crm_saas.custom_fields for update to authenticated
using (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]))
with check (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]));

-- Employees assigned to a customer through a deal should be able to view it too.
drop policy if exists customers_read_by_work_assignment on crm_saas.customers;
create policy customers_read_by_assignment
on crm_saas.customers for select to authenticated
using (
  crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
  or (
    crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
    and (
      exists (
        select 1 from crm_saas.work_items w
        where w.organization_id = customers.organization_id
          and w.customer_id = customers.id
          and w.assigned_to = (select auth.uid())
      )
      or exists (
        select 1 from crm_saas.deals d
        where d.organization_id = customers.organization_id
          and d.customer_id = customers.id
          and d.assigned_to = (select auth.uid())
      )
    )
  )
);

-- Enforce same-organization assignees at the database constraint layer too.
alter table crm_saas.work_items
  add constraint work_items_assigned_member_fkey
  foreign key (organization_id, assigned_to)
  references crm_saas.organization_members(organization_id, user_id)
  on delete set null (assigned_to);

alter table crm_saas.tasks
  add constraint tasks_assigned_member_fkey
  foreign key (organization_id, assigned_to)
  references crm_saas.organization_members(organization_id, user_id)
  on delete set null (assigned_to);

-- Front-line employees need to create customer records as part of intake.
-- The record becomes visible to them only when linked to work they are assigned.
drop policy if exists customers_admin_insert on crm_saas.customers;
create policy customers_member_insert
on crm_saas.customers for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
);

drop policy if exists customers_admin_update on crm_saas.customers;
create policy customers_update_assigned_or_admin
on crm_saas.customers for update to authenticated
using (
  crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
  or (
    crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
    and (
      exists (
        select 1 from crm_saas.work_items w
        where w.organization_id = customers.organization_id
          and w.customer_id = customers.id
          and w.assigned_to = (select auth.uid())
      )
      or exists (
        select 1 from crm_saas.deals d
        where d.organization_id = customers.organization_id
          and d.customer_id = customers.id
          and d.assigned_to = (select auth.uid())
      )
    )
  )
)
with check (
  crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
  or (
    crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
    and (
      exists (
        select 1 from crm_saas.work_items w
        where w.organization_id = customers.organization_id
          and w.customer_id = customers.id
          and w.assigned_to = (select auth.uid())
      )
      or exists (
        select 1 from crm_saas.deals d
        where d.organization_id = customers.organization_id
          and d.customer_id = customers.id
          and d.assigned_to = (select auth.uid())
      )
    )
  )
);

-- Employees may update their own task (or an unassigned task) on accessible
-- work, but cannot assign tasks to a different person.
drop policy if exists tasks_update_accessible_item on crm_saas.tasks;
create policy tasks_update_assigned_or_admin
on crm_saas.tasks for update to authenticated
using (
  crm_saas.can_access_work_item(organization_id, work_item_id)
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
    or assigned_to is null
  )
)
with check (
  crm_saas.can_access_work_item(organization_id, work_item_id)
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
    or assigned_to is null
  )
);

-- Managers may leave a deal unassigned; employees can only create/update their
-- own assigned deals. Same-organization assignee membership is also FK-enforced.
drop policy if exists deals_insert_member on crm_saas.deals;
create policy deals_insert_member
on crm_saas.deals for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
  )
);

drop policy if exists deals_update_assigned_or_admin on crm_saas.deals;
create policy deals_update_assigned_or_admin
on crm_saas.deals for update to authenticated
using (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
)
with check (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
  )
);



-- Ensure newly created organizations always receive core functionality.
create or replace function crm_saas.create_organization(
  p_name text,
  p_slug text,
  p_industry_code text default 'professional_services'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_pipeline uuid;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 160 then
    raise exception 'Organization name must be 1-160 characters' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Invalid organization slug' using errcode = '22023';
  end if;
  if not exists (
    select 1 from crm_saas.industry_modules m
    where m.code = p_industry_code and m.is_available
  ) then
    raise exception 'Unknown or unavailable industry module' using errcode = '22023';
  end if;

  insert into crm_saas.organizations (name, slug, industry_code, created_by)
  values (trim(p_name), p_slug, p_industry_code, v_user)
  returning id into v_org;

  insert into crm_saas.organization_members (organization_id, user_id, role, is_active)
  values (v_org, v_user, 'owner', true);

  insert into crm_saas.organization_modules (organization_id, module_code)
  values (v_org, 'core'), (v_org, p_industry_code)
  on conflict do nothing;

  insert into crm_saas.pipelines (organization_id, name, is_default, created_by)
  values (v_org, 'Основная воронка', true, v_user)
  returning id into v_pipeline;

  insert into crm_saas.pipeline_stages
    (organization_id, pipeline_id, name, position, probability, is_won, is_lost)
  values
    (v_org, v_pipeline, 'Новая', 0, 10, false, false),
    (v_org, v_pipeline, 'В работе', 1, 35, false, false),
    (v_org, v_pipeline, 'Предложение', 2, 70, false, false),
    (v_org, v_pipeline, 'Успешно', 3, 100, true, false),
    (v_org, v_pipeline, 'Закрыта без сделки', 4, 0, false, true);

  return v_org;
end;
$$;

revoke all on function crm_saas.create_organization(text, text, text) from public, anon;
grant execute on function crm_saas.create_organization(text, text, text) to authenticated;
),
  add column if not exists timezone text not null default 'Asia/Tashkent'
    check (length(trim(timezone)) between 1 and 64),
  add column if not exists locale text not null default 'ru'
    check (locale in ('ru', 'uz', 'en')),
  add column if not exists settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object');


alter table crm_saas.customers
  add column if not exists custom_data jsonb not null default '{}'::jsonb
  check (jsonb_typeof(custom_data) = 'object');

alter table crm_saas.work_items
  add column if not exists custom_data jsonb not null default '{}'::jsonb
  check (jsonb_typeof(custom_data) = 'object');

create table crm_saas.pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  entity_type text not null default 'deal' check (entity_type in ('deal')),
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create unique index pipelines_one_default_per_org
  on crm_saas.pipelines (organization_id) where is_default;

create table crm_saas.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  pipeline_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 80),
  position integer not null check (position >= 0),
  probability smallint not null default 0 check (probability between 0 and 100),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, pipeline_id, id),
  unique (organization_id, pipeline_id, position),
  foreign key (organization_id, pipeline_id)
    references crm_saas.pipelines(organization_id, id) on delete cascade,
  check (not (is_won and is_lost))
);

create table crm_saas.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  pipeline_id uuid not null,
  stage_id uuid not null,
  customer_id uuid,
  title text not null check (length(trim(title)) between 1 and 240),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null default 'UZS' check (currency ~ '^[A-Z]{3}$'),
  assigned_to uuid,
  expected_close_date date,
  description text,
  custom_data jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_data) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, pipeline_id, stage_id)
    references crm_saas.pipeline_stages(organization_id, pipeline_id, id) on delete restrict,
  foreign key (organization_id, customer_id)
    references crm_saas.customers(organization_id, id) on delete set null (customer_id),
  foreign key (organization_id, assigned_to)
    references crm_saas.organization_members(organization_id, user_id) on delete set null (assigned_to)
);

create table crm_saas.custom_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('customer', 'work_item', 'deal')),
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  label text not null check (length(trim(label)) between 1 and 100),
  field_type text not null check (field_type in ('text', 'number', 'date', 'boolean', 'select', 'multiselect', 'url')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  is_required boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entity_type, field_key)
);

create index pipeline_stages_order_idx
  on crm_saas.pipeline_stages (organization_id, pipeline_id, position);
create index deals_org_stage_idx
  on crm_saas.deals (organization_id, pipeline_id, stage_id, updated_at desc);
create index deals_org_assignee_idx
  on crm_saas.deals (organization_id, assigned_to, updated_at desc);
create index deals_org_customer_idx
  on crm_saas.deals (organization_id, customer_id);
create index custom_fields_org_entity_idx
  on crm_saas.custom_fields (organization_id, entity_type, is_active);

alter table crm_saas.pipelines enable row level security;
alter table crm_saas.pipeline_stages enable row level security;
alter table crm_saas.deals enable row level security;
alter table crm_saas.custom_fields enable row level security;

grant select, insert, update on crm_saas.pipelines to authenticated;
grant select, insert, update on crm_saas.pipeline_stages to authenticated;
grant select, insert, update on crm_saas.deals to authenticated;
grant select, insert, update on crm_saas.custom_fields to authenticated;

-- A reusable active-membership check. It is intentionally narrowly scoped and
-- does not expose member lists or private organization data.
create or replace function crm_saas_private.is_active_org_member(target_org uuid, target_user uuid)
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
      and m.user_id = target_user
      and m.is_active
      and (
        target_user = (select auth.uid())
        or crm_saas_private.has_org_role(
          target_org,
          array['owner','admin']::crm_saas.organization_role[]
        )
      )
  );
$;

revoke all on function crm_saas_private.is_active_org_member(uuid, uuid) from public, anon;
grant execute on function crm_saas_private.is_active_org_member(uuid, uuid) to authenticated;

-- Replace the initial work-item write rules with member-aware rules. Employees
-- can create work assigned to themselves and edit only work assigned to them.
drop policy if exists work_items_admin_insert on crm_saas.work_items;
drop policy if exists work_items_update_assigned_or_admin on crm_saas.work_items;

create policy work_items_member_insert
on crm_saas.work_items for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
  )
);

create policy work_items_update_assigned_or_admin
on crm_saas.work_items for update to authenticated
using (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
)
with check (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
  )
);

-- Assigned employees may add tasks to their own work items; managers can assign
-- tasks to active members of the same organization.
drop policy if exists tasks_admin_insert on crm_saas.tasks;
create policy tasks_member_insert
on crm_saas.tasks for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas.can_access_work_item(organization_id, work_item_id)
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
  )
);

create policy pipelines_read_member
on crm_saas.pipelines for select to authenticated
using (crm_saas.is_org_member(organization_id));

create policy pipelines_insert_admin
on crm_saas.pipelines for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
);

create policy pipelines_update_admin
on crm_saas.pipelines for update to authenticated
using (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]))
with check (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]));

create policy pipeline_stages_read_member
on crm_saas.pipeline_stages for select to authenticated
using (crm_saas.is_org_member(organization_id));

create policy pipeline_stages_insert_admin
on crm_saas.pipeline_stages for insert to authenticated
with check (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]));

create policy pipeline_stages_update_admin
on crm_saas.pipeline_stages for update to authenticated
using (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]))
with check (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]));

create policy deals_read_assigned_or_admin
on crm_saas.deals for select to authenticated
using (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
);

create policy deals_insert_member
on crm_saas.deals for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and crm_saas_private.is_active_org_member(organization_id, assigned_to)
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
);

create policy deals_update_assigned_or_admin
on crm_saas.deals for update to authenticated
using (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
)
with check (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and crm_saas_private.is_active_org_member(organization_id, assigned_to)
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
);

create policy custom_fields_read_member
on crm_saas.custom_fields for select to authenticated
using (crm_saas.is_org_member(organization_id));

create policy custom_fields_insert_admin
on crm_saas.custom_fields for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
);

create policy custom_fields_update_admin
on crm_saas.custom_fields for update to authenticated
using (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]))
with check (crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[]));

-- Employees assigned to a customer through a deal should be able to view it too.
drop policy if exists customers_read_by_work_assignment on crm_saas.customers;
create policy customers_read_by_assignment
on crm_saas.customers for select to authenticated
using (
  crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
  or (
    crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
    and (
      exists (
        select 1 from crm_saas.work_items w
        where w.organization_id = customers.organization_id
          and w.customer_id = customers.id
          and w.assigned_to = (select auth.uid())
      )
      or exists (
        select 1 from crm_saas.deals d
        where d.organization_id = customers.organization_id
          and d.customer_id = customers.id
          and d.assigned_to = (select auth.uid())
      )
    )
  )
);

-- Enforce same-organization assignees at the database constraint layer too.
alter table crm_saas.work_items
  add constraint work_items_assigned_member_fkey
  foreign key (organization_id, assigned_to)
  references crm_saas.organization_members(organization_id, user_id)
  on delete set null (assigned_to);

alter table crm_saas.tasks
  add constraint tasks_assigned_member_fkey
  foreign key (organization_id, assigned_to)
  references crm_saas.organization_members(organization_id, user_id)
  on delete set null (assigned_to);

-- Front-line employees need to create customer records as part of intake.
-- The record becomes visible to them only when linked to work they are assigned.
drop policy if exists customers_admin_insert on crm_saas.customers;
create policy customers_member_insert
on crm_saas.customers for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
);

drop policy if exists customers_admin_update on crm_saas.customers;
create policy customers_update_assigned_or_admin
on crm_saas.customers for update to authenticated
using (
  crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
  or (
    crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
    and (
      exists (
        select 1 from crm_saas.work_items w
        where w.organization_id = customers.organization_id
          and w.customer_id = customers.id
          and w.assigned_to = (select auth.uid())
      )
      or exists (
        select 1 from crm_saas.deals d
        where d.organization_id = customers.organization_id
          and d.customer_id = customers.id
          and d.assigned_to = (select auth.uid())
      )
    )
  )
)
with check (
  crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
  or (
    crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
    and (
      exists (
        select 1 from crm_saas.work_items w
        where w.organization_id = customers.organization_id
          and w.customer_id = customers.id
          and w.assigned_to = (select auth.uid())
      )
      or exists (
        select 1 from crm_saas.deals d
        where d.organization_id = customers.organization_id
          and d.customer_id = customers.id
          and d.assigned_to = (select auth.uid())
      )
    )
  )
);

-- Employees may update their own task (or an unassigned task) on accessible
-- work, but cannot assign tasks to a different person.
drop policy if exists tasks_update_accessible_item on crm_saas.tasks;
create policy tasks_update_assigned_or_admin
on crm_saas.tasks for update to authenticated
using (
  crm_saas.can_access_work_item(organization_id, work_item_id)
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
    or assigned_to is null
  )
)
with check (
  crm_saas.can_access_work_item(organization_id, work_item_id)
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
    or assigned_to is null
  )
);

-- Managers may leave a deal unassigned; employees can only create/update their
-- own assigned deals. Same-organization assignee membership is also FK-enforced.
drop policy if exists deals_insert_member on crm_saas.deals;
create policy deals_insert_member
on crm_saas.deals for insert to authenticated
with check (
  created_by = (select auth.uid())
  and crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
  )
);

drop policy if exists deals_update_assigned_or_admin on crm_saas.deals;
create policy deals_update_assigned_or_admin
on crm_saas.deals for update to authenticated
using (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
    or assigned_to = (select auth.uid())
  )
)
with check (
  crm_saas_private.is_active_org_member(organization_id, (select auth.uid()))
  and (
    (
      crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
      and (assigned_to is null or crm_saas_private.is_active_org_member(organization_id, assigned_to))
    )
    or assigned_to = (select auth.uid())
  )
);



-- Ensure newly created organizations always receive core functionality.
create or replace function crm_saas.create_organization(
  p_name text,
  p_slug text,
  p_industry_code text default 'professional_services'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_pipeline uuid;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 160 then
    raise exception 'Organization name must be 1-160 characters' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Invalid organization slug' using errcode = '22023';
  end if;
  if not exists (
    select 1 from crm_saas.industry_modules m
    where m.code = p_industry_code and m.is_available
  ) then
    raise exception 'Unknown or unavailable industry module' using errcode = '22023';
  end if;

  insert into crm_saas.organizations (name, slug, created_by)
  values (trim(p_name), p_slug, v_user)
  returning id into v_org;

  insert into crm_saas.organization_members (organization_id, user_id, role, is_active)
  values (v_org, v_user, 'owner', true);

  insert into crm_saas.organization_modules (organization_id, module_code)
  values (v_org, 'core'), (v_org, p_industry_code)
  on conflict do nothing;

  insert into crm_saas.pipelines (organization_id, name, is_default, created_by)
  values (v_org, 'Основная воронка', true, v_user)
  returning id into v_pipeline;

  insert into crm_saas.pipeline_stages
    (organization_id, pipeline_id, name, position, probability, is_won, is_lost)
  values
    (v_org, v_pipeline, 'Новая', 0, 10, false, false),
    (v_org, v_pipeline, 'В работе', 1, 35, false, false),
    (v_org, v_pipeline, 'Предложение', 2, 70, false, false),
    (v_org, v_pipeline, 'Успешно', 3, 100, true, false),
    (v_org, v_pipeline, 'Закрыта без сделки', 4, 0, false, true);

  return v_org;
end;
$$;

revoke all on function crm_saas.create_organization(text, text, text) from public, anon;
grant execute on function crm_saas.create_organization(text, text, text) to authenticated;
