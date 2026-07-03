
-- Enable realtime on orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Vendor updates shipping schedule (recomputes ETA)
CREATE OR REPLACE FUNCTION public.vendor_update_shipping(
  _order_id uuid,
  _depart_at timestamptz,
  _days_min int,
  _days_max int,
  _mode text DEFAULT NULL,
  _courier text DEFAULT NULL,
  _coop text DEFAULT NULL,
  _depart_city text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _o RECORD; _eta timestamptz;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id=_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.vendor_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  _eta := COALESCE(_depart_at, _o.depart_at, now()) + (COALESCE(_days_max, _o.delivery_days_max, 5) || ' days')::interval;
  UPDATE public.orders SET
    depart_at = COALESCE(_depart_at, depart_at),
    delivery_days_min = COALESCE(_days_min, delivery_days_min),
    delivery_days_max = COALESCE(_days_max, delivery_days_max),
    eta_at = _eta,
    shipping_mode = COALESCE(_mode, shipping_mode),
    courier_name = COALESCE(_courier, courier_name),
    coop_name = COALESCE(_coop, coop_name),
    depart_city = COALESCE(_depart_city, depart_city)
   WHERE id = _order_id;

  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_o.client_id, 'Livraison mise à jour ⏱️', _o.product_title || ' — nouveau planning', '/order/' || _order_id || '/tracking');
END $$;
