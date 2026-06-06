
-- 1) Addresses table (clients & vendors can have multiple)
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  province text NOT NULL,
  region text,
  district text,
  city text,
  quartier text NOT NULL,
  street text NOT NULL,
  details text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  formatted_address text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own addresses select" ON public.addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own addresses insert" ON public.addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own addresses update" ON public.addresses FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own addresses delete" ON public.addresses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "vendor sees buyer address via order" ON public.addresses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.client_id = addresses.user_id AND o.vendor_id = auth.uid()));

CREATE INDEX IF NOT EXISTS addresses_user_idx ON public.addresses(user_id);

-- Madagascar bounds validation (lat -25.7..-11.8 ; lng 42.5..51.0)
CREATE OR REPLACE FUNCTION public.validate_address_mg()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.latitude < -26 OR NEW.latitude > -11.5 OR NEW.longitude < 42 OR NEW.longitude > 51.5 THEN
    RAISE EXCEPTION 'GPS hors Madagascar';
  END IF;
  IF NEW.is_default THEN
    UPDATE public.addresses SET is_default = false
      WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default = true;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_address_mg ON public.addresses;
CREATE TRIGGER trg_validate_address_mg
  BEFORE INSERT OR UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.validate_address_mg();

-- 2) Vendor pickup location on vendor_profiles
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS pickup_province text,
  ADD COLUMN IF NOT EXISTS pickup_region text,
  ADD COLUMN IF NOT EXISTS pickup_city text,
  ADD COLUMN IF NOT EXISTS pickup_quartier text,
  ADD COLUMN IF NOT EXISTS pickup_street text,
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS shipping_base_mga bigint NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS shipping_per_km_mga bigint NOT NULL DEFAULT 200;

-- 3) Helper: haversine fallback (km)
CREATE OR REPLACE FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 2 * 6371 * asin(sqrt(
    sin(radians(($3 - $1)/2))^2 +
    cos(radians($1)) * cos(radians($3)) * sin(radians(($4 - $2)/2))^2
  ));
$$;

-- 4) Shipping quote (server fallback; client also uses Routes API via gateway)
CREATE OR REPLACE FUNCTION public.compute_shipping_quote(_vendor_id uuid, _lat double precision, _lng double precision)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _vp RECORD; _km double precision; _fee bigint; _days int;
BEGIN
  SELECT pickup_lat, pickup_lng, shipping_base_mga, shipping_per_km_mga
    INTO _vp FROM public.vendor_profiles WHERE id = _vendor_id;
  IF _vp.pickup_lat IS NULL OR _vp.pickup_lng IS NULL THEN
    RETURN jsonb_build_object('km', null, 'fee_mga', _vp.shipping_base_mga, 'days_min', 2, 'days_max', 5, 'source','default');
  END IF;
  _km := public.haversine_km(_vp.pickup_lat, _vp.pickup_lng, _lat, _lng);
  _fee := _vp.shipping_base_mga + floor(_km * _vp.shipping_per_km_mga)::bigint;
  _days := CASE WHEN _km < 30 THEN 1 WHEN _km < 150 THEN 2 WHEN _km < 500 THEN 4 ELSE 6 END;
  RETURN jsonb_build_object('km', round(_km::numeric, 1), 'fee_mga', _fee, 'days_min', _days, 'days_max', _days + 2, 'source','haversine');
END $$;

GRANT EXECUTE ON FUNCTION public.compute_shipping_quote(uuid, double precision, double precision) TO authenticated;

-- 5) Extend orders to record delivery quote
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee_mga bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_km double precision,
  ADD COLUMN IF NOT EXISTS delivery_days_min int,
  ADD COLUMN IF NOT EXISTS delivery_days_max int,
  ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES public.addresses(id);

-- 6) Update place_order to accept address_id + delivery fee
CREATE OR REPLACE FUNCTION public.place_order(
  _product_id uuid,
  _quantity int,
  _address text,
  _address_id uuid DEFAULT NULL,
  _delivery_fee bigint DEFAULT 0,
  _delivery_km double precision DEFAULT NULL,
  _delivery_days_min int DEFAULT NULL,
  _delivery_days_max int DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p RECORD; _items_total BIGINT; _grand BIGINT; _buyer UUID; _order_id UUID;
  _rate NUMERIC; _days INT; _commission BIGINT; _vendor_amt BIGINT;
  _admin_id UUID; _unit BIGINT;
BEGIN
  _buyer := auth.uid();
  IF _buyer IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT commission_rate, auto_release_days INTO _rate, _days FROM public.app_settings WHERE id=1;
  SELECT * INTO _p FROM public.products WHERE id=_product_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not available'; END IF;
  IF _p.stock < _quantity THEN RAISE EXCEPTION 'insufficient stock'; END IF;

  _unit := _p.price_mga;
  IF _quantity >= 10 THEN _unit := FLOOR(_p.price_mga * 0.98)::BIGINT; END IF;
  _items_total := _unit * _quantity;
  _grand := _items_total + COALESCE(_delivery_fee, 0);
  _commission := FLOOR(_items_total * _rate)::BIGINT;
  _vendor_amt := _items_total - _commission;

  IF (SELECT balance_mga FROM public.wallets WHERE user_id=_buyer) < _grand THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.wallets
     SET balance_mga = balance_mga - _grand,
         balance_spent_mga = balance_spent_mga + _grand,
         updated_at = now()
   WHERE user_id = _buyer;

  INSERT INTO public.wallets (user_id, balance_mga, balance_pending_mga)
    VALUES (_p.vendor_id, 0, _vendor_amt + COALESCE(_delivery_fee,0))
    ON CONFLICT (user_id) DO UPDATE
      SET balance_pending_mga = wallets.balance_pending_mga + _vendor_amt + COALESCE(_delivery_fee,0),
          updated_at = now();

  SELECT user_id INTO _admin_id FROM public.user_roles WHERE role='admin' LIMIT 1;
  IF _admin_id IS NOT NULL AND _commission > 0 THEN
    INSERT INTO public.wallets (user_id, balance_commission_mga)
      VALUES (_admin_id, _commission)
      ON CONFLICT (user_id) DO UPDATE
        SET balance_commission_mga = wallets.balance_commission_mga + _commission,
            updated_at = now();
    INSERT INTO public.wallet_transactions (user_id, type, amount_mga, description)
      VALUES (_admin_id, 'commission', _commission, 'Commission: ' || _p.title);
  END IF;

  UPDATE public.products SET stock = stock - _quantity WHERE id = _product_id;

  INSERT INTO public.orders (client_id, vendor_id, product_id, product_title, product_image,
      quantity, unit_price_mga, total_mga, shipping_address, status,
      commission_mga, vendor_amount_mga, auto_release_at,
      delivery_fee_mga, delivery_km, delivery_days_min, delivery_days_max, address_id)
    VALUES (_buyer, _p.vendor_id, _p.id, _p.title, COALESCE(_p.images[1], NULL),
      _quantity, _unit, _grand, _address, 'paye',
      _commission, _vendor_amt + COALESCE(_delivery_fee,0),
      now() + (_days || ' days')::interval,
      COALESCE(_delivery_fee,0), _delivery_km, _delivery_days_min, _delivery_days_max, _address_id)
    RETURNING id INTO _order_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
    VALUES (_buyer, 'achat', -_grand, _order_id, 'Achat: ' || _p.title);
  INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
    VALUES (_p.vendor_id, 'vendor_pending', _vendor_amt + COALESCE(_delivery_fee,0), _order_id, 'En attente: ' || _p.title);

  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_p.vendor_id, 'Nouvelle commande 🛍️', _p.title || ' x' || _quantity, '/vendeur');
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_buyer, 'Commande confirmée ✅', _p.title, '/client');
  RETURN _order_id;
END $$;
