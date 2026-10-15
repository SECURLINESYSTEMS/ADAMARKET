-- Owner/admin team lifecycle controls. Direct membership writes remain denied.
-- Local/test migration only; do not deploy to hosted ADAMARKET without review.

create or replace function crm_saas.update_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role crm_saas.organization_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $crm$
declare
  v_current_role crm_saas.organization_role;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not crm_saas_private.has_org_role(
    p_organization_id, array['owner']::crm_saas.organization_role[]
  ) then
    raise exception 'Only the organization owner can change member roles' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'The owner role cannot be assigned through team management' using errcode = '22023';
  end if;

  select m.role into v_current_role
  from crm_saas.organization_members m
  where m.organization_id = p_organization_id and m.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Organization member not found' using errcode = 'P0002';
  end if;
  if v_current_role = 'owner' then
    raise exception 'The organization owner role cannot be changed here' using errcode = '42501';
  end if;

  update crm_saas.organization_members
  set role = p_role
  where organization_id = p_organization_id and user_id = p_user_id;
end;
$crm$;

create or replace function crm_saas.set_member_active(
  p_organization_id uuid,
  p_user_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $crm$
declare
  v_actor uuid := auth.uid();
  v_actor_role crm_saas.organization_role;
  v_target_role crm_saas.organization_role;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select m.role into v_actor_role
  from crm_saas.organization_members m
  where m.organization_id = p_organization_id
    and m.user_id = v_actor
    and m.is_active
  for update;

  if not found or v_actor_role not in ('owner', 'admin') then
    raise exception 'Only an active owner or admin can manage team access' using errcode = '42501';
  end if;

  select m.role into v_target_role
  from crm_saas.organization_members m
  where m.organization_id = p_organization_id and m.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Organization member not found' using errcode = 'P0002';
  end if;
  if v_target_role = 'owner' then
    raise exception 'The organization owner cannot be deactivated' using errcode = '42501';
  end if;
  if v_actor_role = 'admin' and v_target_role = 'admin' then
    raise exception 'An admin cannot manage another admin account' using errcode = '42501';
  end if;
  if v_actor = p_user_id and v_actor_role <> 'owner' then
    raise exception 'An admin cannot deactivate their own account' using errcode = '42501';
  end if;

  update crm_saas.organization_members
  set is_active = p_is_active,
      joined_at = case when p_is_active then now() else joined_at end
  where organization_id = p_organization_id and user_id = p_user_id;
end;
$crm$;

revoke all on function crm_saas.update_member_role(uuid, uuid, crm_saas.organization_role) from public, anon;
revoke all on function crm_saas.set_member_active(uuid, uuid, boolean) from public, anon;
grant execute on function crm_saas.update_member_role(uuid, uuid, crm_saas.organization_role) to authenticated;
grant execute on function crm_saas.set_member_active(uuid, uuid, boolean) to authenticated;
