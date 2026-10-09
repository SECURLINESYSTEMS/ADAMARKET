-- Store listing contact details separately from the public listing payload.
alter table public.ad_places
  add column if not exists owner_name text,
  add column if not exists owner_contact text;

create or replace function public.get_ad_place_contact(p_place_id bigint)
returns table(owner_name text, owner_contact text)
language sql
stable
security definer
set search_path = public
as $$
  select p.owner_name, p.owner_contact
  from public.ad_places as p
  where p.id = p_place_id
    and p.status = 'approved'
    and p.is_active = true
    and auth.uid() is not null;
$$;

revoke all on function public.get_ad_place_contact(bigint) from public;
grant execute on function public.get_ad_place_contact(bigint) to authenticated;
