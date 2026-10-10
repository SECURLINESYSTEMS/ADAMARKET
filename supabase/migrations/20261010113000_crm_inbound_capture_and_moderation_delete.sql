-- Admin delete for SecurLineUz partner requests, plus automatic CRM lead capture.
drop policy if exists "partner requests admin delete" on public.partner_requests;
create policy "partner requests admin delete" on public.partner_requests
for delete to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create or replace function public.crm_capture_ad_place()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  contact text := nullif(trim(new.owner_contact), '');
begin
  if contact is null then return new; end if;
  insert into public.crm_leads(full_name, phone, email, company_name, source, interest, status, estimated_value, notes, created_by)
  values (
    coalesce(nullif(trim(new.owner_name), ''), 'Владелец объявления #' || new.id::text),
    case when contact !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then contact else null end,
    case when contact ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then contact else null end,
    null,
    'Объявление ADAMARKET',
    coalesce(nullif(trim(new.title), ''), 'Новое объявление') || case when new.type is not null then ' · ' || new.type else '' end,
    'new',
    coalesce(new.price, 0),
    'Автоматически создано из объявления #' || new.id::text || '. Статус объявления: ' || coalesce(new.status, 'pending'),
    new.owner_id
  );
  return new;
end;
$$;
revoke all on function public.crm_capture_ad_place() from public, anon, authenticated;
drop trigger if exists crm_capture_ad_place_after_insert on public.ad_places;
create trigger crm_capture_ad_place_after_insert after insert on public.ad_places
for each row execute function public.crm_capture_ad_place();

create or replace function public.crm_capture_partner_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if nullif(trim(new.phone), '') is null then return new; end if;
  insert into public.crm_leads(full_name, phone, source, interest, status, estimated_value, notes)
  values (
    coalesce(nullif(trim(new.name), ''), 'Заявитель SecurLineUz #' || new.id::text),
    nullif(trim(new.phone), ''),
    coalesce(nullif(trim(new.source), ''), 'ADAMARKET'),
    coalesce(nullif(trim(new.product), ''), 'Заявка SecurLineUz'),
    'new',
    coalesce(nullif(regexp_replace(coalesce(new.price, ''), '[^0-9.]', '', 'g'), '')::numeric, 0),
    'Автоматически создано из заявки SecurLineUz #' || new.id::text || case when nullif(trim(new.comment), '') is not null then E'\n' || new.comment else '' end
  );
  return new;
exception when invalid_text_representation or numeric_value_out_of_range then
  insert into public.crm_leads(full_name, phone, source, interest, status, estimated_value, notes)
  values (coalesce(nullif(trim(new.name), ''), 'Заявитель SecurLineUz #' || new.id::text), nullif(trim(new.phone), ''), coalesce(nullif(trim(new.source), ''), 'ADAMARKET'), coalesce(nullif(trim(new.product), ''), 'Заявка SecurLineUz'), 'new', 0, 'Автоматически создано из заявки SecurLineUz #' || new.id::text);
  return new;
end;
$$;
revoke all on function public.crm_capture_partner_request() from public, anon, authenticated;
drop trigger if exists crm_capture_partner_request_after_insert on public.partner_requests;
create trigger crm_capture_partner_request_after_insert after insert on public.partner_requests
for each row execute function public.crm_capture_partner_request();

create or replace function public.crm_capture_buyer_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  contact_email text;
  contact_name text;
  listing_title text;
  contact_phone text;
begin
  select u.email, coalesce(nullif(trim(p.full_name), ''), u.email), p.phone
    into contact_email, contact_name, contact_phone
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = new.advertiser_id;
  select a.title into listing_title from public.ad_places a where a.id = new.place_id;
  if nullif(trim(contact_phone), '') is null and nullif(trim(contact_email), '') is null then return new; end if;
  insert into public.crm_leads(full_name, phone, email, source, interest, status, notes, created_by)
  values (
    coalesce(contact_name, 'Пользователь ADAMARKET'),
    nullif(trim(contact_phone), ''),
    nullif(trim(contact_email), ''),
    'Заявка покупателя ADAMARKET',
    coalesce(listing_title, 'Объявление #' || new.place_id::text),
    'new',
    coalesce(new.message, '') || case when new.date is not null then E'\nДата заявки: ' || new.date else '' end,
    new.advertiser_id
  );
  return new;
end;
$$;
revoke all on function public.crm_capture_buyer_request() from public, anon, authenticated;
drop trigger if exists crm_capture_buyer_request_after_insert on public.requests;
create trigger crm_capture_buyer_request_after_insert after insert on public.requests
for each row execute function public.crm_capture_buyer_request();
