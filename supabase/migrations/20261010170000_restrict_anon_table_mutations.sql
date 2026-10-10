-- Public visitors may read public catalog data and submit the SecurLineUz partner form.
-- They must not mutate marketplace, CRM, payment, booking, or profile records.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
GRANT INSERT ON TABLE public.partner_requests TO anon;
