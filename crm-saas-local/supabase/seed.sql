-- Synthetic seed data only; no users, companies, or customer data from production.
insert into crm_saas.industry_modules (code, name, description, is_available)
values
  ('service_installation', 'Service and installation', 'Requests, site visits, installation work and maintenance.', true),
  ('general_sales', 'General sales', 'Customer pipeline and follow-up tasks.', false)
on conflict (code) do nothing;
