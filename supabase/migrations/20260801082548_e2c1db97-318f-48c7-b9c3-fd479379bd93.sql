
-- 1. PROMOTIONS
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_percent smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_until timestamptz,
  ADD COLUMN IF NOT EXISTS sold_count bigint NOT NULL DEFAULT 0;

-- 2. USER EVENTS (comportement)
CREATE TABLE IF NOT EXISTS public.user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid,
  category_id uuid,
  event_type text NOT NULL,
  query text,
  dwell_ms integer NOT NULL DEFAULT 0,
  price_mga bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_events TO authenticated;
GRANT ALL ON public.user_events TO service_role;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own events select" ON public.user_events;
CREATE POLICY "own events select" ON public.user_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own events insert" ON public.user_events;
CREATE POLICY "own events insert" ON public.user_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_user ON public.user_events(user_id, created_at DESC);

-- 3. COUPONS
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  percent smallint NOT NULL DEFAULT 1,
  product_id uuid,
  category_id uuid,
  reason text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own coupons" ON public.coupons;
CREATE POLICY "own coupons" ON public.coupons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_user ON public.coupons(user_id, expires_at DESC);

-- 4. TRACK EVENT
CREATE OR REPLACE FUNCTION public.track_event(
  _event_type text, _product_id uuid DEFAULT NULL, _query text DEFAULT NULL, _dwell_ms integer DEFAULT 0
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _cat uuid; _price bigint;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF _product_id IS NOT NULL THEN
    SELECT category_id, price_mga INTO _cat, _price FROM public.products WHERE id = _product_id;
  END IF;
  INSERT INTO public.user_events (user_id, product_id, category_id, event_type, query, dwell_ms, price_mga)
  VALUES (_uid, _product_id, _cat, _event_type, _query, GREATEST(0, COALESCE(_dwell_ms,0)), _price);
END; $$;
REVOKE EXECUTE ON FUNCTION public.track_event(text, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_event(text, uuid, text, integer) TO authenticated;

-- 5. FEED IA
CREATE OR REPLACE FUNCTION public.feed_products(
  _tab text DEFAULT 'pour_toi',
  _category uuid DEFAULT NULL,
  _q text DEFAULT NULL,
  _min_price bigint DEFAULT NULL,
  _max_price bigint DEFAULT NULL,
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0
) RETURNS TABLE (
  id uuid, title text, price_mga bigint, images text[], category_id uuid,
  discount_percent smallint, promo_until timestamptz, sold_count bigint,
  view_count bigint, click_count bigint, created_at timestamptz,
  final_price_mga bigint, score double precision
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _events int := 0;
  _avg_price numeric := NULL;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT count(*), avg(price_mga) INTO _events, _avg_price
      FROM public.user_events WHERE user_id = _uid AND created_at > now() - interval '90 days';
  END IF;

  RETURN QUERY
  WITH pref AS (
    SELECT e.category_id AS cid, count(*)::double precision AS w
      FROM public.user_events e
     WHERE _uid IS NOT NULL AND e.user_id = _uid AND e.category_id IS NOT NULL
       AND e.created_at > now() - interval '90 days'
     GROUP BY e.category_id
  ),
  base AS (
    SELECT p.id, p.title, p.price_mga, p.images, p.category_id,
           p.discount_percent, p.promo_until, p.sold_count,
           p.view_count, p.click_count, p.created_at,
           CASE WHEN p.discount_percent > 0 AND (p.promo_until IS NULL OR p.promo_until > now())
                THEN floor(p.price_mga * (100 - p.discount_percent) / 100.0)::bigint
                ELSE p.price_mga END AS final_price_mga,
           COALESCE((SELECT w FROM pref WHERE pref.cid = p.category_id), 0) AS aff
      FROM public.products p
     WHERE p.is_active = true AND p.stock > 0
       AND (_category IS NULL OR p.category_id = _category)
       AND (_q IS NULL OR _q = '' OR p.title ILIKE '%'||_q||'%' OR COALESCE(p.description,'') ILIKE '%'||_q||'%')
  ),
  filtered AS (
    SELECT b.* FROM base b
     WHERE (_min_price IS NULL OR b.final_price_mga >= _min_price)
       AND (_max_price IS NULL OR b.final_price_mga <= _max_price)
       AND CASE _tab
             WHEN 'promos' THEN b.discount_percent > 0 AND (b.promo_until IS NULL OR b.promo_until > now())
             WHEN 'flash' THEN b.discount_percent >= 20 AND b.promo_until IS NOT NULL AND b.promo_until > now()
             WHEN 'nouveautes' THEN b.created_at > now() - interval '21 days'
             WHEN 'bon_marche' THEN b.final_price_mga <= 20000
             WHEN 'coupons' THEN EXISTS (
                SELECT 1 FROM public.coupons c
                 WHERE c.user_id = _uid AND c.used_at IS NULL AND c.expires_at > now()
                   AND (c.product_id = b.id OR (c.product_id IS NULL AND (c.category_id IS NULL OR c.category_id = b.category_id))))
             ELSE true
           END
  )
  SELECT f.id, f.title, f.price_mga, f.images, f.category_id,
         f.discount_percent, f.promo_until, f.sold_count,
         f.view_count, f.click_count, f.created_at, f.final_price_mga,
         (
           CASE _tab
             WHEN 'tendance' THEN ln(1 + f.click_count) * 40 + ln(1 + f.view_count) * 20 + f.sold_count * 8
             WHEN 'nouveautes' THEN 100 - EXTRACT(epoch FROM (now() - f.created_at)) / 86400.0
             WHEN 'bon_marche' THEN 1000000.0 / GREATEST(f.final_price_mga, 1)
             WHEN 'promos' THEN f.discount_percent * 10 + ln(1 + f.click_count) * 5
             WHEN 'flash' THEN f.discount_percent * 10 + ln(1 + f.view_count) * 5
             ELSE 0
           END
           + f.aff * 25
           + ln(1 + f.click_count) * 6 + ln(1 + f.view_count) * 3 + f.sold_count * 5
           + CASE WHEN _avg_price IS NOT NULL
                  THEN 20 * exp(-abs(f.final_price_mga - _avg_price) / GREATEST(_avg_price, 1))
                  ELSE 0 END
           + CASE WHEN _events < 5 THEN 300000.0 / GREATEST(f.final_price_mga, 1) ELSE 0 END
           + CASE WHEN f.discount_percent > 0 THEN f.discount_percent * 1.5 ELSE 0 END
         )::double precision AS score
    FROM filtered f
   ORDER BY score DESC, f.created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 60)) OFFSET GREATEST(0, _offset);
END; $$;
REVOKE EXECUTE ON FUNCTION public.feed_products(text, uuid, text, bigint, bigint, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_products(text, uuid, text, bigint, bigint, integer, integer) TO anon, authenticated;

-- 6. COUPONS IA
CREATE OR REPLACE FUNCTION public.grant_loyalty_coupons()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _activity int; _orders int; _pct smallint; _cat uuid; _n int := 0;
BEGIN
  IF _uid IS NULL THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.coupons WHERE user_id=_uid AND used_at IS NULL AND expires_at > now()) THEN
    RETURN 0;
  END IF;
  SELECT count(*) INTO _activity FROM public.user_events
   WHERE user_id=_uid AND created_at > now() - interval '30 days';
  SELECT count(*) INTO _orders FROM public.orders WHERE client_id=_uid;
  IF _activity < 15 AND _orders < 1 THEN RETURN 0; END IF;
  _pct := LEAST(5, GREATEST(1, (_activity / 40) + _orders))::smallint;
  SELECT category_id INTO _cat FROM public.user_events
   WHERE user_id=_uid AND category_id IS NOT NULL AND created_at > now() - interval '60 days'
   GROUP BY category_id ORDER BY count(*) DESC LIMIT 1;
  INSERT INTO public.coupons (user_id, code, percent, category_id, reason)
  VALUES (_uid, 'AIO-' || upper(substring(md5(gen_random_uuid()::text) from 1 for 7)), _pct, _cat,
          'Fidélité: ' || _activity || ' interactions');
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_uid, 'Coupon fidélité 🎫', 'Vous avez gagné -' || _pct || '% sur vos produits préférés.', '/client');
  RETURN 1;
END; $$;
REVOKE EXECUTE ON FUNCTION public.grant_loyalty_coupons() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_loyalty_coupons() TO authenticated;

-- 7. PROMOTION VENDEUR
CREATE OR REPLACE FUNCTION public.vendor_set_promo(_product_id uuid, _percent smallint, _until timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=_product_id AND vendor_id=auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _percent < 0 OR _percent > 90 THEN RAISE EXCEPTION 'invalid percent'; END IF;
  UPDATE public.products SET discount_percent=_percent, promo_until=_until, updated_at=now()
   WHERE id=_product_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.vendor_set_promo(uuid, smallint, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_set_promo(uuid, smallint, timestamptz) TO authenticated;

-- 8. FRAIS PAR ZONE (grille invisible côté client)
CREATE OR REPLACE FUNCTION public.vendor_zone_fee(_vendor_id uuid, _address_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _v RECORD; _a RECORD; _z jsonb; _fee bigint; _label text;
BEGIN
  SELECT shipping_base_mga, shipping_zones INTO _v FROM public.vendor_profiles WHERE id=_vendor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('fee_mga', 0, 'matched', false); END IF;
  SELECT province, region, city, quartier INTO _a FROM public.addresses
   WHERE id=_address_id AND user_id=auth.uid();
  _fee := COALESCE(_v.shipping_base_mga, 0);
  IF _a IS NOT NULL AND jsonb_typeof(_v.shipping_zones) = 'array' THEN
    FOR _z IN SELECT jsonb_array_elements(_v.shipping_zones) LOOP
      IF (COALESCE(_z->>'province','') <> '' AND lower(_z->>'province') = lower(COALESCE(_a.province,'')))
         OR (COALESCE(_z->>'region','') <> '' AND lower(_z->>'region') = lower(COALESCE(_a.region,'')))
         OR (COALESCE(_z->>'city','') <> '' AND lower(_z->>'city') = lower(COALESCE(_a.city,'')))
         OR (COALESCE(_z->>'label','') <> '' AND (
              lower(_z->>'label') = lower(COALESCE(_a.province,'')) OR
              lower(_z->>'label') = lower(COALESCE(_a.region,'')) OR
              lower(_z->>'label') = lower(COALESCE(_a.city,''))))
      THEN
        _fee := COALESCE((_z->>'fee_mga')::bigint, _fee);
        _label := _z->>'label';
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('fee_mga', _fee, 'matched', _label IS NOT NULL);
END; $$;
REVOKE EXECUTE ON FUNCTION public.vendor_zone_fee(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_zone_fee(uuid, uuid) TO authenticated;

-- 9. STATUTS COLIS VENDEUR
CREATE OR REPLACE FUNCTION public.vendor_set_tracking(
  _order_id uuid, _status text,
  _depart_at timestamptz DEFAULT NULL, _eta_at timestamptz DEFAULT NULL,
  _depart_city text DEFAULT NULL, _courier text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o RECORD; _label text;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id=_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.vendor_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('prepared','shipped','in_transit','nearby','at_depot','delivered','cancelled') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.orders SET
    tracking_status = _status,
    depart_at = CASE WHEN _status='shipped' THEN COALESCE(_depart_at, depart_at, now()) ELSE COALESCE(_depart_at, depart_at) END,
    eta_at = COALESCE(_eta_at, eta_at),
    depart_city = COALESCE(_depart_city, depart_city),
    courier_name = COALESCE(_courier, courier_name),
    shipped_at = CASE WHEN _status='shipped' THEN COALESCE(shipped_at, now()) ELSE shipped_at END,
    in_transit_at = CASE WHEN _status='in_transit' THEN COALESCE(in_transit_at, now()) ELSE in_transit_at END,
    delivered_at = CASE WHEN _status='delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
    status = CASE WHEN _status='delivered' THEN 'livre'::order_status
                  WHEN _status IN ('shipped','in_transit','nearby','at_depot') THEN 'expedie'::order_status
                  WHEN _status='cancelled' THEN 'annule'::order_status
                  ELSE status END,
    updated_at = now()
   WHERE id=_order_id;

  _label := CASE _status
    WHEN 'prepared' THEN '📦 Colis préparé'
    WHEN 'shipped' THEN '🚚 Départ'
    WHEN 'in_transit' THEN '🛣 En route'
    WHEN 'nearby' THEN '📍 À proximité'
    WHEN 'at_depot' THEN '🏢 En dépôt'
    WHEN 'delivered' THEN '🏠 Livré'
    ELSE '❌ Livraison annulée' END;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_o.client_id, _label, _o.product_title, '/order/' || _order_id || '/tracking');
END; $$;
REVOKE EXECUTE ON FUNCTION public.vendor_set_tracking(uuid, text, timestamptz, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_set_tracking(uuid, text, timestamptz, timestamptz, text, text) TO authenticated;

-- 10. place_order : prix promo + compteur de ventes + coupon
CREATE OR REPLACE FUNCTION public.place_order(
  _product_id uuid, _quantity integer, _address text, _address_id uuid DEFAULT NULL,
  _delivery_fee bigint DEFAULT 0, _delivery_km double precision DEFAULT NULL,
  _delivery_days_min integer DEFAULT NULL, _delivery_days_max integer DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p RECORD; _items_total BIGINT; _grand BIGINT; _buyer UUID; _order_id UUID;
  _rate NUMERIC; _days INT; _commission BIGINT; _vendor_amt BIGINT;
  _admin_id UUID; _unit BIGINT; _coupon RECORD;
BEGIN
  _buyer := auth.uid();
  IF _buyer IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT commission_rate, auto_release_days INTO _rate, _days FROM public.app_settings WHERE id=1;
  SELECT * INTO _p FROM public.products WHERE id=_product_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not available'; END IF;
  IF _p.stock < _quantity THEN RAISE EXCEPTION 'insufficient stock'; END IF;

  _unit := _p.price_mga;
  IF _p.discount_percent > 0 AND (_p.promo_until IS NULL OR _p.promo_until > now()) THEN
    _unit := FLOOR(_unit * (100 - _p.discount_percent) / 100.0)::BIGINT;
  END IF;
  IF _quantity >= 10 THEN _unit := FLOOR(_unit * 0.98)::BIGINT; END IF;

  SELECT * INTO _coupon FROM public.coupons c
   WHERE c.user_id=_buyer AND c.used_at IS NULL AND c.expires_at > now()
     AND (c.product_id = _p.id OR (c.product_id IS NULL AND (c.category_id IS NULL OR c.category_id = _p.category_id)))
   ORDER BY c.percent DESC LIMIT 1;
  IF FOUND THEN
    _unit := FLOOR(_unit * (100 - _coupon.percent) / 100.0)::BIGINT;
    UPDATE public.coupons SET used_at = now() WHERE id = _coupon.id;
  END IF;

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
        SET balance_commission_mga = wallets.balance_commission_mga + _commission, updated_at = now();
    INSERT INTO public.wallet_transactions (user_id, type, amount_mga, description)
      VALUES (_admin_id, 'commission', _commission, 'Commission: ' || _p.title);
  END IF;

  UPDATE public.products SET stock = stock - _quantity, sold_count = sold_count + _quantity WHERE id = _product_id;

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

  INSERT INTO public.user_events (user_id, product_id, category_id, event_type, price_mga)
    VALUES (_buyer, _p.id, _p.category_id, 'purchase', _unit);

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
