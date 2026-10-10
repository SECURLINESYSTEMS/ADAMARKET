-- Optimize remaining row-level auth checks and remove exact duplicate permissive policies.
-- Duplicate policies below have identical predicates to a retained policy, so access semantics are unchanged.
ALTER POLICY "Users manage own bookings" ON public.beauty_bookings
  USING ((SELECT auth.uid()) = client_id)
  WITH CHECK ((SELECT auth.uid()) = client_id);
DROP POLICY IF EXISTS "beauty bookings own" ON public.beauty_bookings;

ALTER POLICY "Users manage own favorites" ON public.beauty_favorites
  USING ((SELECT auth.uid()) = client_id)
  WITH CHECK ((SELECT auth.uid()) = client_id);
DROP POLICY IF EXISTS "beauty favorites own" ON public.beauty_favorites;

ALTER POLICY "Users manage own profile" ON public.beauty_profiles
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS "beauty profiles own" ON public.beauty_profiles;

ALTER POLICY "Users can create reviews" ON public.beauty_reviews
  WITH CHECK ((SELECT auth.uid()) = client_id);
DROP POLICY IF EXISTS "beauty reviews create" ON public.beauty_reviews;

DROP POLICY IF EXISTS "beauty reviews public" ON public.beauty_reviews;
