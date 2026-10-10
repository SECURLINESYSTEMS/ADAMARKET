-- Tighten RPC exposure for trigger-only functions and pin a safe search_path.
-- Trigger execution remains governed by the trigger definition; these functions
-- are not intended to be callable directly through PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.ad_places_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- These RPCs are for signed-in users only. Keep authenticated execution intact.
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ad_place_contact(bigint) FROM PUBLIC, anon;

-- Pin search_path even though this function is SECURITY INVOKER.
CREATE OR REPLACE FUNCTION public.get_my_balance()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  SELECT COALESCE(balance, 0)
  FROM public.profiles
  WHERE id = auth.uid();
$function$;
