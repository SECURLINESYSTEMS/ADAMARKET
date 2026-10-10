CREATE OR REPLACE FUNCTION public.guard_ad_producer_moderation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF private.is_admin()
     OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_active := false;
    NEW.rating := 0;
    NEW.reviews_count := 0;
  ELSE
    NEW.is_active := OLD.is_active;
    NEW.rating := OLD.rating;
    NEW.reviews_count := OLD.reviews_count;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_ad_producer_moderation ON public.ad_producers;
CREATE TRIGGER trg_guard_ad_producer_moderation
BEFORE INSERT OR UPDATE ON public.ad_producers
FOR EACH ROW
EXECUTE FUNCTION public.guard_ad_producer_moderation();
