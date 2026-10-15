-- Company settings, safe team invitations and operational metadata.
-- Local/test migration only; do not deploy to hosted ADAMARKET without review.

alter table crm_saas.organizations
  add column if not exists industry_code text not null default 'professional_services'
    references crm_saas.industry_modules(code),
  add column if not exists default_currency text not null default 'UZS'
    check (default_currency ~ '^[A-Z]{3}$'),
  add column if not exists timezone text not null default 'Asia/Tashkent'
    check (length(trim(timezone)) between 1 and 64),
  add column if not exists locale text not null default 'ru'
    check (locale in ('ru', 'uz', 'en')),
  add column if not exists settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object');

alter table crm_saas.tasks
  add column if not exists description text,
  add column if not exists priority smallint not null default 3 check (priority between 1 and 5),
  add column if not exists completed_at timestamptz,
  add column if not exists custom_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(custom_data) = 'object');

-- Enforce that assignments always point to a member of the same organization.
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

-- Database-managed timestamps prevent stale updated_at values from clients.
create or replace function crm_saas_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $crm$
begin
  new.updated_at := now();
  return new;
end;
$crm$;

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

create table crm_saas.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  invitee_email text,
  invitee_phone text,
  role crm_saas.organization_role not null default 'member' check (role in ('admin', 'member')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (invitee_email is not null and invitee_phone is null)
    or (invitee_email is null and invitee_phone is not null)
  ),
  check (invitee_email is null or (
    invitee_email = lower(trim(invitee_email))
    and invitee_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  )),
  check (invitee_phone is null or invitee_phone ~ '^\+[1-9][0-9]{7,14}$')
);

create index organization_invites_org_created_idx
  on crm_saas.organization_invites (organization_id, created_at desc);
create index organization_invites_pending_idx
  on crm_saas.organization_invites (organization_id, expires_at)
  where accepted_at is null;

alter table crm_saas.organization_invites enable row level security;
grant select on crm_saas.organization_invites to authenticated;

create policy organization_invites_read_admin
on crm_saas.organization_invites for select to authenticated
using (crm_saas_private.has_org_role(
  organization_id, array['owner','admin']::crm_saas.organization_role[]
));

-- The owner/admin receives the raw invitation token once. Only a hash is stored.
-- Email/SMS delivery is intentionally separate; a later notification service can
-- send the generated link without exposing service-role credentials to the client.
create or replace function crm_saas.create_invite(
  p_organization_id uuid,
  p_invitee_email text default null,
  p_invitee_phone text default null,
  p_role crm_saas.organization_role default 'member'
)
returns table (invite_id uuid, invite_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $crm$
declare
  v_user uuid := auth.uid();
  v_email text := nullif(lower(trim(p_invitee_email)), '');
  v_phone text := nullif(trim(p_invitee_phone), '');
  v_token text;
  v_expires timestamptz := now() + interval '7 days';
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not crm_saas_private.has_org_role(
    p_organization_id, array['owner','admin']::crm_saas.organization_role[]
  ) then
    raise exception 'Only an organization owner or admin can invite team members' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Invitations cannot grant the owner role' using errcode = '22023';
  end if;
  if (v_email is null) = (v_phone is null) then
    raise exception 'Provide exactly one confirmed email or phone number' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Invalid invitation email' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone must be in international E.164 format' using errcode = '22023';
  end if;

  if v_email is not null and exists (
    select 1 from auth.users u
    join crm_saas.organization_members m on m.user_id = u.id
    where m.organization_id = p_organization_id and m.is_active
      and lower(u.email) = v_email
  ) then
    raise exception 'This account is already an active member' using errcode = '23505';
  end if;
  if v_phone is not null and exists (
    select 1 from auth.users u
    join crm_saas.organization_members m on m.user_id = u.id
    where m.organization_id = p_organization_id and m.is_active
      and u.phone = v_phone
  ) then
    raise exception 'This account is already an active member' using errcode = '23505';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into crm_saas.organization_invites
    (organization_id, invitee_email, invitee_phone, role, token_hash, invited_by, expires_at)
  values
    (p_organization_id, v_email, v_phone, p_role, md5(v_token), v_user, v_expires)
  returning id into invite_id;

  invite_token := v_token;
  expires_at := v_expires;
  return next;
end;
$crm$;

create or replace function crm_saas.accept_invite(p_invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $crm$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_phone text;
  v_email_confirmed timestamptz;
  v_phone_confirmed timestamptz;
  v_invite crm_saas.organization_invites%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_invite_token is null or length(p_invite_token) <> 64 then
    raise exception 'Invalid invitation token' using errcode = '42501';
  end if;

  select u.email, u.phone, u.email_confirmed_at, u.phone_confirmed_at
    into v_email, v_phone, v_email_confirmed, v_phone_confirmed
  from auth.users u where u.id = v_user;

  select i.* into v_invite
  from crm_saas.organization_invites i
  where i.token_hash = md5(p_invite_token)
    and i.accepted_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'Invitation is invalid, expired or already used' using errcode = '42501';
  end if;

  if v_invite.invitee_email is not null and (
    v_email_confirmed is null or v_email is null or lower(v_email) <> v_invite.invitee_email
  ) then
    raise exception 'Sign in with the confirmed email address that was invited' using errcode = '42501';
  end if;
  if v_invite.invitee_phone is not null and (
    v_phone_confirmed is null or v_phone is null or v_phone <> v_invite.invitee_phone
  ) then
    raise exception 'Sign in with the confirmed phone number that was invited' using errcode = '42501';
  end if;

  if exists (
    select 1 from crm_saas.organization_members m
    where m.organization_id = v_invite.organization_id and m.user_id = v_user and m.is_active
  ) then
    raise exception 'This account is already an active member' using errcode = '23505';
  end if;

  insert into crm_saas.organization_members (organization_id, user_id, role, is_active, joined_at)
  values (v_invite.organization_id, v_user, v_invite.role, true, now())
  on conflict (organization_id, user_id)
  do update set role = excluded.role, is_active = true, joined_at = now();

  update crm_saas.organization_invites
  set accepted_at = now()
  where id = v_invite.id;

  return v_invite.organization_id;
end;
$crm$;

revoke all on function crm_saas.create_invite(uuid, text, text, crm_saas.organization_role) from public, anon;
revoke all on function crm_saas.accept_invite(text) from public, anon;
grant execute on function crm_saas.create_invite(uuid, text, text, crm_saas.organization_role) to authenticated;
grant execute on function crm_saas.accept_invite(text) to authenticated;

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
