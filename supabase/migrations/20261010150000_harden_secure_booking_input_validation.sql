-- Validate all required booking inputs before doing date arithmetic.
-- Lock the approved space row to serialize concurrent requests for the same space.
CREATE OR REPLACE FUNCTION public.create_secure_booking(
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
  v_space public.ad_spaces%ROWTYPE;
  v_booking public.bookings;
  v_amount numeric;
  v_days integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_space_id IS NULL
     OR p_start_date IS NULL
     OR p_end_date IS NULL
     OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'INVALID_BOOKING_PERIOD';
  END IF;

  SELECT *
    INTO v_space
    FROM public.ad_spaces
   WHERE id = p_space_id
     AND status = 'approved'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SPACE_NOT_AVAILABLE';
  END IF;

  IF v_space.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'OWNER_CANNOT_BOOK_OWN_SPACE';
  END IF;

  IF v_space.price_month < 0 THEN
    RAISE EXCEPTION 'INVALID_PRICE';
  END IF;

  v_days := (p_end_date - p_start_date) + 1;
  v_amount := round((v_space.price_month / 30.0) * v_days, 2);

  INSERT INTO public.bookings (
    space_id,
    advertiser_id,
    start_date,
    end_date,
    status,
    total_amount,
    currency,
    payment_status
  ) VALUES (
    p_space_id,
    auth.uid(),
    p_start_date,
    p_end_date,
    'pending',
    v_amount,
    'UZS',
    'unpaid'
  )
  RETURNING * INTO v_booking;

  RETURN v_booking;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'DATES_ALREADY_BOOKED';
END;
$function$;
