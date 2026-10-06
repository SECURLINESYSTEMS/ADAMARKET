-- Free Beta: every authenticated user may submit a listing for moderation
-- and send a request. Publication remains inactive until moderation approves it.
DROP POLICY IF EXISTS ad_places_owner_insert ON public.ad_places;
CREATE POLICY ad_places_owner_insert ON public.ad_places FOR INSERT TO authenticated
WITH CHECK (owner_id = (select auth.uid()) AND status = 'pending' AND is_active = false);

DROP POLICY IF EXISTS requests_insert ON public.requests;
CREATE POLICY requests_insert ON public.requests FOR INSERT TO authenticated
WITH CHECK (advertiser_id = (select auth.uid()));
