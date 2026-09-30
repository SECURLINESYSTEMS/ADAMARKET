create schema if not exists private;

create or replace function private.current_account_type()
returns text
language sql stable security definer set search_path = ''
as $$ select p.account_type from public.profiles p where p.id = (select auth.uid()); $$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'); $$;

revoke all on function private.current_account_type() from public;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_account_type() to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.profiles drop constraint if exists profiles_inn_format;
alter table public.profiles add constraint profiles_inn_format check (inn is null or inn ~ '^[0-9]{9,14}$');

create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare r text;
begin
  select p.role into r from public.profiles p where p.id = (select auth.uid());
  if (select auth.uid()) is null or r = 'admin' then return new; end if;
  new.id := old.id;
  new.role := old.role;
  new.account_type := old.account_type;
  new.balance := old.balance;
  new.telegram_id := old.telegram_id;
  new.telegram_username := old.telegram_username;
  if new.inn is not null and new.inn !~ '^[0-9]{9,14}$' then raise exception 'ИНН фирмы должен содержать 9-14 цифр'; end if;
  return new;
end;
$$;

DROP POLICY IF EXISTS ad_places_owner_insert ON public.ad_places;
CREATE POLICY ad_places_owner_insert ON public.ad_places FOR INSERT TO authenticated
WITH CHECK (owner_id = (select auth.uid()) AND status = 'pending' AND is_active = false AND ((select private.is_admin()) OR (select private.current_account_type()) = 'business'));

DROP POLICY IF EXISTS ad_places_owner_update ON public.ad_places;
CREATE POLICY ad_places_owner_update ON public.ad_places FOR UPDATE TO authenticated
USING (owner_id = (select auth.uid()) OR (select private.is_admin()))
WITH CHECK (owner_id = (select auth.uid()) OR (select private.is_admin()));

DROP POLICY IF EXISTS ad_places_owner_delete ON public.ad_places;
CREATE POLICY ad_places_owner_delete ON public.ad_places FOR DELETE TO authenticated
USING (owner_id = (select auth.uid()) OR (select private.is_admin()));

DROP POLICY IF EXISTS producers_insert_own ON public.ad_producers;
CREATE POLICY producers_insert_own ON public.ad_producers FOR INSERT TO authenticated
WITH CHECK (owner_id = (select auth.uid()) AND ((select private.is_admin()) OR (select private.current_account_type()) = 'manufacturer'));

DROP POLICY IF EXISTS producers_update_own ON public.ad_producers;
CREATE POLICY producers_update_own ON public.ad_producers FOR UPDATE TO authenticated
USING (owner_id = (select auth.uid()) OR (select private.is_admin()))
WITH CHECK (owner_id = (select auth.uid()) OR (select private.is_admin()));

DROP POLICY IF EXISTS producers_delete_own ON public.ad_producers;
CREATE POLICY producers_delete_own ON public.ad_producers FOR DELETE TO authenticated
USING (owner_id = (select auth.uid()) OR (select private.is_admin()));

DROP POLICY IF EXISTS spaces_owner_insert ON public.ad_spaces;
CREATE POLICY spaces_owner_insert ON public.ad_spaces FOR INSERT TO authenticated
WITH CHECK (owner_id = (select auth.uid()) AND ((select private.is_admin()) OR (select private.current_account_type()) = 'business'));

DROP POLICY IF EXISTS spaces_owner_update ON public.ad_spaces;
CREATE POLICY spaces_owner_update ON public.ad_spaces FOR UPDATE TO authenticated
USING (owner_id = (select auth.uid()) OR (select private.is_admin()))
WITH CHECK (owner_id = (select auth.uid()) OR (select private.is_admin()));

DROP POLICY IF EXISTS subscriptions_insert_own ON public.subscriptions;
CREATE POLICY subscriptions_insert_own ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()) AND status = 'pending');

DROP POLICY IF EXISTS requests_insert ON public.requests;
CREATE POLICY requests_insert ON public.requests FOR INSERT TO authenticated
WITH CHECK (advertiser_id = (select auth.uid()) AND (select private.current_account_type()) = 'advertiser');
