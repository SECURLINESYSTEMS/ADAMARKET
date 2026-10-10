-- Remove broad default API grants that bypass row-level policies for destructive privileges.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.wallet_transactions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.bookings FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ad_spaces FROM anon, authenticated;

-- Profiles: signed-in users can read/create/update through RLS and protective triggers.
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- Wallet ledger is read-only to its owner; all writes must go through trusted functions.
GRANT SELECT ON TABLE public.wallet_transactions TO authenticated;

-- Bookings are created through SECURITY DEFINER RPCs; direct table writes are disabled.
GRANT SELECT ON TABLE public.bookings TO authenticated;

-- Legacy ad-space catalog: public reads are still filtered by RLS; signed-in owners can manage their rows.
GRANT SELECT ON TABLE public.ad_spaces TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.ad_spaces TO authenticated;
