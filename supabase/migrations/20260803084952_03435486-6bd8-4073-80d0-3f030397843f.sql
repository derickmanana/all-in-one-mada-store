CREATE OR REPLACE FUNCTION public.vendor_update_delivery(
  _order_id uuid,
  _fee bigint DEFAULT NULL,
  _depart_at timestamptz DEFAULT NULL,
  _days_min integer DEFAULT NULL,
  _days_max integer DEFAULT NULL,
  _mode text DEFAULT NULL,
  _courier text DEFAULT NULL,
  _coop text DEFAULT NULL,
  _depart_city text DEFAULT NULL,
  _address text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _o RECORD; _eta timestamptz; _delta bigint := 0;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id=_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.vendor_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _fee IS NOT NULL AND _fee <> _o.delivery_fee_mga THEN
    IF _fee < 0 THEN RAISE EXCEPTION 'invalid fee'; END IF;
    IF _o.vendor_released THEN RAISE EXCEPTION 'order already released'; END IF;
    _delta := _fee - _o.delivery_fee_mga;
    IF _delta > 0 AND (SELECT balance_mga FROM public.wallets WHERE user_id=_o.client_id) < _delta THEN
      RAISE EXCEPTION 'client balance insufficient';
    END IF;
    UPDATE public.wallets
       SET balance_mga = balance_mga - _delta,
           balance_spent_mga = GREATEST(0, balance_spent_mga + _delta),
           updated_at = now()
     WHERE user_id = _o.client_id;
    UPDATE public.wallets
       SET balance_pending_mga = GREATEST(0, balance_pending_mga + _delta), updated_at = now()
     WHERE user_id = _o.vendor_id;
    INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
      VALUES (_o.client_id, 'achat', -_delta, _order_id, 'Ajustement frais de livraison');
    INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
      VALUES (_o.vendor_id, 'vendor_pending', _delta, _order_id, 'Ajustement frais de livraison');
    INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (_o.client_id, 'Frais de livraison mis à jour 🚚', _o.product_title || ' — nouveaux frais: ' || _fee || ' MGA', '/order/' || _order_id || '/tracking');
  END IF;

  _eta := COALESCE(_depart_at, _o.depart_at, now())
          + (COALESCE(_days_max, _o.delivery_days_max, 5) || ' days')::interval;

  UPDATE public.orders SET
    delivery_fee_mga = COALESCE(_fee, delivery_fee_mga),
    total_mga = total_mga + _delta,
    vendor_amount_mga = vendor_amount_mga + _delta,
    depart_at = COALESCE(_depart_at, depart_at),
    delivery_days_min = COALESCE(_days_min, delivery_days_min),
    delivery_days_max = COALESCE(_days_max, delivery_days_max),
    eta_at = _eta,
    shipping_mode = COALESCE(_mode, shipping_mode),
    courier_name = COALESCE(_courier, courier_name),
    coop_name = COALESCE(_coop, coop_name),
    depart_city = COALESCE(_depart_city, depart_city),
    shipping_address = COALESCE(NULLIF(_address,''), shipping_address),
    updated_at = now()
  WHERE id = _order_id;

  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_o.client_id, 'Livraison mise à jour ⏱️', _o.product_title || ' — informations actualisées', '/order/' || _order_id || '/tracking');
END;
$function$;

REVOKE ALL ON FUNCTION public.vendor_update_delivery(uuid, bigint, timestamptz, integer, integer, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_update_delivery(uuid, bigint, timestamptz, integer, integer, text, text, text, text, text) TO authenticated;