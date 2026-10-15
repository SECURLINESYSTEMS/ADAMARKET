begin;

select plan(26);

-- Synthetic-only fixtures. The entire test transaction is rolled back.
insert into auth.users
  (id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'crm-owner-a@example.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'crm-member-a@example.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'crm-member-b@example.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'crm-owner-b@example.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'crm-invitee@example.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into crm_saas.organizations (id, name, slug, created_by)
values
  ('20000000-0000-4000-8000-000000000001', 'Test Company A', 'test-company-a', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Test Company B', 'test-company-b', '10000000-0000-4000-8000-000000000004');

insert into crm_saas.organization_members (organization_id, user_id, role, is_active)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', true),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'member', true),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'member', true),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'owner', true);

insert into crm_saas.customers (id, organization_id, display_name, created_by)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Customer A1', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Customer A2', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'Customer B1', '10000000-0000-4000-8000-000000000004');

insert into crm_saas.work_items
  (id, organization_id, customer_id, title, assigned_to, created_by)
values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Assigned to member A', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Assigned to member B', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'Other company work', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004');

insert into crm_saas.tasks
  (id, organization_id, work_item_id, title, created_by)
values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Task on assigned work', '10000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'Task on coworker work', '10000000-0000-4000-8000-000000000001');

insert into crm_saas.pipelines (id, organization_id, name, is_default, created_by)
values
  ('60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Pipeline A', true, '10000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Pipeline B', true, '10000000-0000-4000-8000-000000000004');

insert into crm_saas.pipeline_stages
  (id, organization_id, pipeline_id, name, position)
values
  ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'New A', 0),
  ('70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', 'New B', 0);

insert into crm_saas.deals
  (id, organization_id, pipeline_id, stage_id, customer_id, title, assigned_to, created_by)
values
  ('80000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Assigned deal A', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001'),
  ('80000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Assigned deal B', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001'),
  ('80000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'Other company deal', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

select is((select count(*)::int from crm_saas.work_items), 1, 'employee sees only work assigned to them');
select is((select count(*)::int from crm_saas.work_items where assigned_to = '10000000-0000-4000-8000-000000000003'), 0, 'employee cannot see coworker work');
select is((select count(*)::int from crm_saas.work_items where organization_id = '20000000-0000-4000-8000-000000000002'), 0, 'employee cannot see another company');
select is((select count(*)::int from crm_saas.customers), 1, 'employee sees only customers linked to assigned work');
select is((select count(*)::int from crm_saas.tasks), 1, 'employee sees only tasks linked to assigned work');
select is((select count(*)::int from crm_saas.deals), 1, 'employee sees only assigned deals');

select lives_ok(
  $$insert into crm_saas.work_items (organization_id, title, assigned_to, created_by)
    values ('20000000-0000-4000-8000-000000000001', 'Member-created work', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002')$$,
  'employee can create a request assigned to themselves'
);

select throws_ok(
  $$insert into crm_saas.work_items (organization_id, title, assigned_to, created_by)
    values ('20000000-0000-4000-8000-000000000001', 'Unauthorized assignment', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'employee cannot assign work to another employee'
);

select lives_ok(
  $$insert into crm_saas.customers (organization_id, display_name, created_by)
    values ('20000000-0000-4000-8000-000000000001', 'Customer created by employee', '10000000-0000-4000-8000-000000000002')$$,
  'employee can register a customer during intake'
);

select throws_ok(
  $$update crm_saas.tasks set assigned_to = '10000000-0000-4000-8000-000000000003'
    where id = '50000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'employee cannot reassign a task to a coworker'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::int from crm_saas.work_items), 3, 'owner sees all work in their own company, including member-created work');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select crm_saas.create_organization('Onboarding test company', 'crm-onboarding-test', 'professional_services')$$,
  'authenticated user can create an organization through the safe onboarding function'
);
select is((
  select count(*)::int
  from crm_saas.organizations o
  join crm_saas.organization_members m on m.organization_id = o.id
  where o.slug = 'crm-onboarding-test'
    and m.user_id = '10000000-0000-4000-8000-000000000002'
    and m.role = 'owner'
    and m.is_active
), 1, 'organization creator becomes active owner');

select is((
  select count(*)::int
  from crm_saas.pipelines p
  join crm_saas.organizations o on o.id = p.organization_id
  where o.slug = 'crm-onboarding-test' and p.is_default
), 1, 'onboarding creates one default sales pipeline');

select is((
  select count(*)::int
  from crm_saas.pipeline_stages s
  join crm_saas.pipelines p on p.id = s.pipeline_id and p.organization_id = s.organization_id
  join crm_saas.organizations o on o.id = p.organization_id
  where o.slug = 'crm-onboarding-test'
), 5, 'onboarding creates five default pipeline stages');

select throws_ok(
  $$update crm_saas.organization_members set role = 'owner'
    where organization_id = '20000000-0000-4000-8000-000000000001'
      and user_id = '10000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'employee cannot promote themselves to owner'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select set_config(
    'crm.test_invite_token',
    (select i.invite_token
     from crm_saas.create_invite(
       '20000000-0000-4000-8000-000000000001',
       'crm-invitee@example.test',
       null,
       'member'::crm_saas.organization_role
     ) as i),
    true
  )$$,
  'owner can create a single-use invitation for a confirmed email identity'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select crm_saas.accept_invite(current_setting('crm.test_invite_token'))$$,
  '42501', null,
  'invitation cannot be claimed by a different account'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select lives_ok(
  $$select crm_saas.accept_invite(current_setting('crm.test_invite_token'))$$,
  'invited user can accept using their confirmed email account'
);
select is((
  select count(*)::int
  from crm_saas.organization_members m
  join crm_saas.organization_invites i on i.organization_id = m.organization_id
  where m.user_id = '10000000-0000-4000-8000-000000000005'
    and m.organization_id = '20000000-0000-4000-8000-000000000001'
    and m.role = 'member'
    and m.is_active
    and i.invitee_email = 'crm-invitee@example.test'
    and i.accepted_at is not null
), 1, 'accepted invite creates membership and marks the token as used');

select throws_ok(
  $select crm_saas.accept_invite(current_setting('crm.test_invite_token'))$,
  '42501', null,
  'invitation token cannot be reused after acceptance'
);


select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $select crm_saas.update_member_role(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    'admin'::crm_saas.organization_role
  )$,
  'owner can promote an invited member to admin'
);
select is((
  select count(*)::int
  from crm_saas.organization_members
  where organization_id = '20000000-0000-4000-8000-000000000001'
    and user_id = '10000000-0000-4000-8000-000000000005'
    and role = 'admin' and is_active
), 1, 'role update changes only the intended membership');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select throws_ok(
  $select crm_saas.set_member_active(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    false
  )$,
  '42501', null,
  'admin cannot deactivate the organization owner'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $select crm_saas.set_member_active(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    false
  )$,
  'owner can deactivate an employee'
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*)::int from crm_saas.work_items), 0, 'deactivated employee loses access to company work');

select * from finish();
rollback;
