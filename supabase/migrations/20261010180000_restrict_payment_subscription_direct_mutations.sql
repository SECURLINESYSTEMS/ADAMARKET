-- Payment and subscription changes must go through the authenticated Edge API.
-- The Edge Function uses the service role after validating the caller and admin role.
REVOKE ALL PRIVILEGES ON TABLE public.payments, public.subscriptions FROM anon, authenticated;
GRANT SELECT ON TABLE public.payments, public.subscriptions TO authenticated;
