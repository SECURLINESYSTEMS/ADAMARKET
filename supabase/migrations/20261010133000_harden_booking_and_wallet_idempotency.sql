-- Harden booking availability checks and make wallet spending retries idempotent.
-- A repeated payment reference with the same amount is treated as a successful retry;
-- reusing a reference with a different amount is rejected.

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_payment_reference_uidx
ON public.wallet_transactions (user_id, reference_id)
WHERE type = 'payment' AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.spend_balance(
  p_amount bigint,
  p_description text DEFAULT NULL,
  p_reference_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_balance bigint;
  existing_amount bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Пользователь не авторизован';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Сумма должна быть больше нуля';
  END IF;

  SELECT COALESCE(balance, 0)
    INTO current_balance
    FROM public.profiles
   WHERE id = auth.uid()
   FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'Профиль пользователя не найден';
  END IF;

  IF p_reference_id IS NOT NULL THEN
    SELECT amount
      INTO existing_amount
      FROM public.wallet_transactions
     WHERE user_id = auth.uid()
       AND type = 'payment'
       AND reference_id = p_reference_id
     LIMIT 1;

    IF FOUND THEN
      IF existing_amount = -p_amount THEN
        RETURN TRUE;
      END IF;
      RAISE EXCEPTION 'REFERENCE_ALREADY_USED';
    END IF;
  END IF;

  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Недостаточно средств';
  END IF;

  UPDATE public.profiles
     SET balance = balance - p_amount
   WHERE id = auth.uid();

  INSERT INTO public.wallet_transactions (
    user_id, amount, type, status, description, reference_id
  ) VALUES (
    auth.uid(), -p_amount, 'payment', 'completed', p_description, p_reference_id
  );

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_booking(
  p_space_id bigint,
  p_start_date date,
  p_end_date date
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_space public.ad_places;
  v_booking public.bookings;
  v_days integer;
  v_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'INVALID_DATES';
  END IF;

  SELECT *
    INTO v_space
    FROM public.ad_places
   WHERE id = p_space_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLACE_NOT_FOUND';
  END IF;

  IF v_space.status <> 'approved' OR v_space.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'PLACE_NOT_AVAILABLE';
  END IF;

  IF v_space.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'OWNER_CANNOT_BOOK_OWN_PLACE';
  END IF;

  v_days := (p_end_date - p_start_date) + 1;
  v_total := COALESCE(v_space.price, 0) * v_days;

  IF v_total < 0 THEN
    RAISE EXCEPTION 'INVALID_PRICE';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.bookings b
     WHERE b.space_id = p_space_id
       AND b.status IN ('pending', 'confirmed')
       AND daterange(b.start_date, b.end_date, '[]')
           && daterange(p_start_date, p_end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'DATES_ALREADY_BOOKED';
  END IF;

  INSERT INTO public.bookings (
    space_id, advertiser_id, start_date, end_date, status,
    total_amount, currency, payment_status
  ) VALUES (
    p_space_id, auth.uid(), p_start_date, p_end_date, 'pending',
    v_total, 'UZS', 'unpaid'
  )
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$function$;
