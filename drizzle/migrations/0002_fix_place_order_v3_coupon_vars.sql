CREATE OR REPLACE FUNCTION public.place_order_v3(
  _product_id uuid,
  _quantity integer,
  _address text,
  _address_id uuid DEFAULT NULL::uuid,
  _delivery_fee bigint DEFAULT 0,
  _delivery_km double precision DEFAULT NULL::double precision,
  _delivery_days_min integer DEFAULT NULL::integer,
  _delivery_days_max integer DEFAULT NULL::integer,
  _coupon_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _p RECORD; _items_total BIGINT; _grand BIGINT; _buyer UUID; _order_id UUID;
  _rate NUMERIC; _days INT; _commission BIGINT; _vendor_amt BIGINT;
  _admin_id UUID; _unit BIGINT;
  _c_id UUID; _c_pct SMALLINT; _c_used TIMESTAMPTZ; _c_exp TIMESTAMPTZ;
  _c_prod UUID; _c_cat UUID;
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

  IF _coupon_id IS NOT NULL THEN
    SELECT c.id, c.percent, c.used_at, c.expires_at, c.product_id, c.category_id
      INTO _c_id, _c_pct, _c_used, _c_exp, _c_prod, _c_cat
      FROM public.coupons c
     WHERE c.id = _coupon_id AND c.user_id = _buyer
     FOR UPDATE;
    IF _c_id IS NULL THEN RAISE EXCEPTION 'coupon_not_found'; END IF;
    IF _c_used IS NOT NULL THEN RAISE EXCEPTION 'coupon_already_used'; END IF;
    IF _c_exp <= now() THEN RAISE EXCEPTION 'coupon_expired'; END IF;
    IF _c_prod IS NOT NULL AND _c_prod <> _p.id THEN RAISE EXCEPTION 'coupon_not_applicable'; END IF;
    IF _c_prod IS NULL AND _c_cat IS NOT NULL AND _c_cat IS DISTINCT FROM _p.category_id THEN
      RAISE EXCEPTION 'coupon_not_applicable';
    END IF;
  ELSE
    SELECT c.id, c.percent INTO _c_id, _c_pct
      FROM public.coupons c
     WHERE c.user_id=_buyer AND c.used_at IS NULL AND c.expires_at > now()
       AND (c.product_id = _p.id OR (c.product_id IS NULL AND (c.category_id IS NULL OR c.category_id = _p.category_id)))
     ORDER BY c.percent DESC LIMIT 1;
  END IF;

  IF _c_id IS NOT NULL THEN
    _unit := FLOOR(_unit * (100 - _c_pct) / 100.0)::BIGINT;
    UPDATE public.coupons SET used_at = now() WHERE id = _c_id;
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
END $function$;

REVOKE ALL ON FUNCTION public.place_order_v3(uuid, integer, text, uuid, bigint, double precision, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order_v3(uuid, integer, text, uuid, bigint, double precision, integer, integer, uuid) TO authenticated, service_role;