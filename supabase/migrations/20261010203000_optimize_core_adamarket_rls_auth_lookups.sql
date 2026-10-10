-- Use scalar subqueries for stable auth lookups in core ADAMARKET RLS policies.
-- This preserves row-access semantics while allowing PostgreSQL to evaluate auth.uid() once per statement.
ALTER POLICY spaces_public_read_approved ON public.ad_spaces
  USING ((status = 'approved'::text) OR (owner_id = (SELECT auth.uid())));

ALTER POLICY requests_select ON public.requests
  USING (
    ((SELECT auth.uid()) = advertiser_id)
    OR EXISTS (
      SELECT 1 FROM public.ad_places
      WHERE public.ad_places.id = requests.place_id
        AND public.ad_places.owner_id = (SELECT auth.uid())
    )
  );

ALTER POLICY requests_update ON public.requests
  USING (
    EXISTS (
      SELECT 1 FROM public.ad_places
      WHERE public.ad_places.id = requests.place_id
        AND public.ad_places.owner_id = (SELECT auth.uid())
    )
  );

ALTER POLICY bookings_advertiser_read_own ON public.bookings
  USING (advertiser_id = (SELECT auth.uid()));

ALTER POLICY bookings_owner_read ON public.bookings
  USING (
    EXISTS (
      SELECT 1 FROM public.ad_places p
      WHERE p.id = bookings.space_id
        AND p.owner_id = (SELECT auth.uid())
    )
  );

ALTER POLICY "Users can view own wallet transactions" ON public.wallet_transactions
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY ad_places_owner_select ON public.ad_places
  USING ((SELECT auth.uid()) = owner_id);

ALTER POLICY profiles_select_own ON public.profiles
  USING ((SELECT auth.uid()) = id);

ALTER POLICY profiles_insert_own ON public.profiles
  WITH CHECK ((SELECT auth.uid()) = id);

ALTER POLICY profiles_update_own ON public.profiles
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

ALTER POLICY "partner requests admin read" ON public.partner_requests
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::text
    )
  );

ALTER POLICY "partner requests admin update" ON public.partner_requests
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'::text
    )
  );
