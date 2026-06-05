CREATE OR REPLACE FUNCTION public.place_order(_product_id uuid, _quantity integer, _address text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _p RECORD; _total BIGINT; _buyer UUID; _order_id UUID;
  _rate NUMERIC; _days INT; _commission BIGINT; _vendor_amt BIGINT;
  _admin_id UUID; _unit BIGINT;
BEGIN
  _buyer := auth.uid();
  IF _buyer IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT commission_rate, auto_release_days INTO _rate, _days FROM public.app_settings WHERE id=1;
  SELECT * INTO _p FROM public.products WHERE id=_product_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not available'; END IF;
  IF _p.stock < _quantity THEN RAISE EXCEPTION 'insufficient stock'; END IF;

  -- Auto bulk discount: 2% off when buying 10+ of same product
  _unit := _p.price_mga;
  IF _quantity >= 10 THEN
    _unit := FLOOR(_p.price_mga * 0.98)::BIGINT;
  END IF;
  _total := _unit * _quantity;
  _commission := FLOOR(_total * _rate)::BIGINT;
  _vendor_amt := _total - _commission;

  IF (SELECT balance_mga FROM public.wallets WHERE user_id=_buyer) < _total THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.wallets
     SET balance_mga = balance_mga - _total,
         balance_spent_mga = balance_spent_mga + _total,
         updated_at = now()
   WHERE user_id = _buyer;

  INSERT INTO public.wallets (user_id, balance_mga, balance_pending_mga)
    VALUES (_p.vendor_id, 0, _vendor_amt)
    ON CONFLICT (user_id) DO UPDATE
      SET balance_pending_mga = wallets.balance_pending_mga + _vendor_amt,
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
      commission_mga, vendor_amount_mga, auto_release_at)
    VALUES (_buyer, _p.vendor_id, _p.id, _p.title, COALESCE(_p.images[1], NULL),
      _quantity, _unit, _total, _address, 'paye',
      _commission, _vendor_amt, now() + (_days || ' days')::interval)
    RETURNING id INTO _order_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
    VALUES (_buyer, 'achat', -_total, _order_id, 'Achat: ' || _p.title);
  INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
    VALUES (_p.vendor_id, 'vendor_pending', _vendor_amt, _order_id, 'En attente: ' || _p.title);

  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_p.vendor_id, 'Nouvelle commande 🛍️', _p.title || ' x' || _quantity, '/vendeur');
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_buyer, 'Commande confirmée ✅', _p.title, '/client');
  RETURN _order_id;
END; $function$;