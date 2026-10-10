-- Pin remaining privileged trigger functions to an empty search_path.
-- All referenced application objects are schema-qualified.
ALTER FUNCTION public.ad_places_guard() SET search_path = '';
ALTER FUNCTION public.add_balance(uuid, bigint, text, text) SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.protect_ad_place_status() SET search_path = '';
ALTER FUNCTION public.protect_ad_space_status() SET search_path = '';
ALTER FUNCTION public.protect_profile_role() SET search_path = '';
ALTER FUNCTION public.set_ad_places_updated_at() SET search_path = '';
ALTER FUNCTION public.guard_ad_producer_moderation() SET search_path = '';
