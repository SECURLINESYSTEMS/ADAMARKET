-- Private work-item attachments with tenant and assignment-aware Storage policies.
-- File objects are stored under: <organization UUID>/<work-item UUID>/<unique filename>.

insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-files', 'crm-files', false, 20971520)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

create or replace function crm_saas_private.can_access_crm_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[];
begin
  parts := storage.foldername(object_name);
  if parts is null or array_length(parts, 1) < 2 then
    return false;
  end if;
  if parts[1] !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or parts[2] !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;
  return crm_saas_private.can_access_work_item(parts[1]::uuid, parts[2]::uuid);
exception
  when invalid_text_representation then
    return false;
end;
$$;

revoke all on function crm_saas_private.can_access_crm_file(text) from public, anon;
grant execute on function crm_saas_private.can_access_crm_file(text) to authenticated;

create table crm_saas.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_saas.organizations(id) on delete cascade,
  work_item_id uuid not null,
  storage_path text not null unique,
  original_filename text not null check (length(trim(original_filename)) between 1 and 255),
  content_type text,
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id, work_item_id)
    references crm_saas.work_items(organization_id, id) on delete cascade,
  check (storage_path like organization_id::text || '/' || work_item_id::text || '/%')
);

create index attachments_org_work_item_created_idx
  on crm_saas.attachments (organization_id, work_item_id, created_at desc);

alter table crm_saas.attachments enable row level security;
grant select, insert, delete on crm_saas.attachments to authenticated;

create policy attachments_read_accessible_work
on crm_saas.attachments for select to authenticated
using (crm_saas_private.can_access_work_item(organization_id, work_item_id));

create policy attachments_insert_accessible_work
on crm_saas.attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and crm_saas_private.can_access_work_item(organization_id, work_item_id)
  and storage_path like organization_id::text || '/' || work_item_id::text || '/%'
);

create policy attachments_delete_owner_or_manager
on crm_saas.attachments for delete to authenticated
using (
  crm_saas_private.can_access_work_item(organization_id, work_item_id)
  and (
    uploaded_by = (select auth.uid())
    or crm_saas_private.has_org_role(organization_id, array['owner','admin']::crm_saas.organization_role[])
  )
);

drop policy if exists crm_files_read_accessible_work on storage.objects;
create policy crm_files_read_accessible_work
on storage.objects for select to authenticated
using (bucket_id = 'crm-files' and crm_saas_private.can_access_crm_file(name));

drop policy if exists crm_files_upload_accessible_work on storage.objects;
create policy crm_files_upload_accessible_work
on storage.objects for insert to authenticated
with check (bucket_id = 'crm-files' and crm_saas_private.can_access_crm_file(name));

drop policy if exists crm_files_delete_owner_or_manager on storage.objects;
create policy crm_files_delete_owner_or_manager
on storage.objects for delete to authenticated
using (
  bucket_id = 'crm-files'
  and crm_saas_private.can_access_crm_file(name)
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1 from crm_saas.attachments a
      where a.storage_path = storage.objects.name
        and crm_saas_private.has_org_role(a.organization_id, array['owner','admin']::crm_saas.organization_role[])
    )
  )
);
