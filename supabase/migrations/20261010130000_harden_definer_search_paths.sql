-- Pin SECURITY DEFINER RPC functions to an empty search_path.
-- All application objects referenced by these functions are schema-qualified.
ALTER FUNCTION public.create_booking(bigint, date, date) SET search_path = '';
ALTER FUNCTION public.create_secure_booking(bigint, date, date) SET search_path = '';
ALTER FUNCTION public.get_ad_place_contact(bigint) SET search_path = '';
ALTER FUNCTION public.is_current_user_admin() SET search_path = '';
ALTER FUNCTION public.spend_balance(bigint, text, text) SET search_path = '';
