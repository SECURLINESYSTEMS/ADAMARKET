-- Atomically confirm a pending manual payment and create its subscription.
-- Only the trusted service-role Edge Function may call this endpoint.
CREATE OR REPLACE FUNCTION public.admin_confirm_payment(p_payment_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_plan_id bigint;
  v_plan public.plans%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_payment_id IS NULL OR p_payment_id <= 0 THEN
    RAISE EXCEPTION 'Invalid payment ID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status <> 'pending' THEN
    RAISE EXCEPTION 'Payment already processed' USING ERRCODE = '55000';
  END IF;

  IF v_payment.description !~ '^ADAMARKET_PLAN:[0-9]+:[^:]+:.+$' THEN
    RAISE EXCEPTION 'Payment does not contain a valid plan reference' USING ERRCODE = '22023';
  END IF;

  v_plan_id := split_part(v_payment.description, ':', 2)::bigint;

  SELECT * INTO v_plan
  FROM public.plans
  WHERE id = v_plan_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found or inactive' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.amount IS DISTINCT FROM v_plan.price_monthly
     OR v_payment.currency <> 'UZS' THEN
    RAISE EXCEPTION 'Payment amount or currency does not match the plan' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.subscriptions
    (user_id, plan_id, status, starts_at, ends_at, auto_renew)
  VALUES
    (v_payment.user_id, v_plan.id, 'active', now(), now() + interval '30 days', false)
  RETURNING * INTO v_subscription;

  UPDATE public.payments
  SET status = 'paid',
      subscription_id = v_subscription.id,
      paid_at = now()
  WHERE id = p_payment_id AND status = 'pending'
  RETURNING * INTO v_payment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment status changed during confirmation' USING ERRCODE = '55000';
  END IF;

  RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'subscription', to_jsonb(v_subscription));
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_confirm_payment(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_payment(bigint) TO service_role;
