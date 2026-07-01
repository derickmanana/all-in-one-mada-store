
-- 1. Add tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_mode text,
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS coop_name text,
  ADD COLUMN IF NOT EXISTS depart_city text,
  ADD COLUMN IF NOT EXISTS depart_at timestamptz,
  ADD COLUMN IF NOT EXISTS eta_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_status text NOT NULL DEFAULT 'prepare',
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS in_transit_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- 2. Vendor ships order (mode + livreur + départ + ETA)
CREATE OR REPLACE FUNCTION public.vendor_ship_order(
  _order_id uuid,
  _mode text,
  _courier text,
  _coop text,
  _depart_city text,
  _depart_at timestamptz,
  _days_min int,
  _days_max int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _o RECORD; _eta timestamptz;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id=_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.vendor_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  _eta := COALESCE(_depart_at, now()) + (COALESCE(_days_max, 5) || ' days')::interval;
  UPDATE public.orders SET
    status = 'expedie',
    tracking_status = 'shipped',
    shipping_mode = _mode,
    courier_name = _courier,
    coop_name = _coop,
    depart_city = _depart_city,
    depart_at = COALESCE(_depart_at, now()),
    eta_at = _eta,
    delivery_days_min = COALESCE(_days_min, delivery_days_min),
    delivery_days_max = COALESCE(_days_max, delivery_days_max),
    shipped_at = now()
   WHERE id = _order_id;

  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_o.client_id, 'Colis expédié 🚚', _o.product_title, '/order/' || _order_id || '/tracking');
END $$;

-- 3. Vendor marks in-transit ("Aller Livrée")
CREATE OR REPLACE FUNCTION public.vendor_mark_in_transit(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id=_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.vendor_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.orders SET tracking_status='in_transit', in_transit_at=now() WHERE id=_order_id;
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_o.client_id, 'Colis en route 📦', _o.product_title, '/order/' || _order_id || '/tracking');
END $$;

GRANT EXECUTE ON FUNCTION public.vendor_ship_order(uuid,text,text,text,text,timestamptz,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_mark_in_transit(uuid) TO authenticated;
