-- Keep moderation status changes restricted to administrators and service-role operations.
CREATE OR REPLACE FUNCTION public.protect_ad_space_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT private.is_admin()
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'Only an administrator can change ad space status';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_ad_space_status ON public.ad_spaces;
CREATE TRIGGER trg_protect_ad_space_status
BEFORE UPDATE ON public.ad_spaces
FOR EACH ROW
EXECUTE FUNCTION public.protect_ad_space_status();
