-- Consolidate the remaining overlapping SELECT policies while preserving their OR semantics.
ALTER POLICY ad_places_public_approved ON public.ad_places
  USING (
    ((status = 'approved'::text) AND (is_active = true))
    OR (owner_id = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS ad_places_owner_select ON public.ad_places;

ALTER POLICY bookings_advertiser_read_own ON public.bookings
  USING (
    (advertiser_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.ad_places p
      WHERE p.id = bookings.space_id
        AND p.owner_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS bookings_owner_read ON public.bookings;

ALTER POLICY requests_select ON public.requests
  USING (
    ((SELECT auth.uid()) = advertiser_id)
    OR EXISTS (
      SELECT 1 FROM public.ad_places
      WHERE public.ad_places.id = requests.place_id
        AND public.ad_places.owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::text
    )
  );
DROP POLICY IF EXISTS requests_admin_read ON public.requests;
