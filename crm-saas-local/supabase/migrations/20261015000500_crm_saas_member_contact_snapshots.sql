-- Keep human-readable member contact snapshots for team management UI.
-- Values are copied from the authenticated account; only self/manager RLS can read them.

alter table crm_saas.organization_members
  add column if not exists display_name text,
  add column if not exists email text,
  add column if not exists phone text;

create index if not exists organization_members_org_active_role_idx
  on crm_saas.organization_members (organization_id, is_active, role);

create or replace function crm_saas.create_organization(
  p_name text,
  p_slug text,
  p_industry_code text default 'professional_services'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $crm$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_pipeline uuid;
  v_member_email text;
  v_member_phone text;
  v_display_name text;
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

  select u.email, u.phone,
         coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
                  u.email, u.phone, 'Пользователь')
    into v_member_email, v_member_phone, v_display_name
  from auth.users u where u.id = v_user;

  insert into crm_saas.organization_members
    (organization_id, user_id, role, is_active, display_name, email, phone)
  values (v_org, v_user, 'owner', true, v_display_name, v_member_email, v_member_phone);

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
$crm$;

revoke all on function crm_saas.create_organization(text, text, text) from public, anon;
grant execute on function crm_saas.create_organization(text, text, text) to authenticated;

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
  v_user_meta jsonb;
  v_display_name text;
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

  select u.email, u.phone, u.raw_user_meta_data, u.email_confirmed_at, u.phone_confirmed_at
    into v_email, v_phone, v_user_meta, v_email_confirmed, v_phone_confirmed
  from auth.users u where u.id = v_user;

  v_display_name := coalesce(nullif(trim(v_user_meta ->> 'full_name'), ''),
                             nullif(trim(v_user_meta ->> 'name'), ''),
                             v_email, v_phone, 'Пользователь');

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

  insert into crm_saas.organization_members
    (organization_id, user_id, role, is_active, joined_at, display_name, email, phone)
  values (v_invite.organization_id, v_user, v_invite.role, true, now(), v_display_name, v_email, v_phone)
  on conflict (organization_id, user_id)
  do update set role = excluded.role,
                is_active = true,
                joined_at = now(),
                display_name = excluded.display_name,
                email = excluded.email,
                phone = excluded.phone;

  update crm_saas.organization_invites
  set accepted_at = now()
  where id = v_invite.id;

  return v_invite.organization_id;
end;
$crm$;

revoke all on function crm_saas.accept_invite(text) from public, anon;
grant execute on function crm_saas.accept_invite(text) to authenticated;
