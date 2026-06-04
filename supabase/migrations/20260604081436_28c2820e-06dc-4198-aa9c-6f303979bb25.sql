
-- ============ ENUM EXTENSIONS ============
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'vendor_pending';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'vendor_release';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'retrait';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'retrait_refus';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'transfert_admin';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'envoi_admin';

-- ============ WALLETS: multi-soldes ============
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS balance_spent_mga BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_pending_mga BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_commission_mga BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_admin_funds_mga BIGINT NOT NULL DEFAULT 0;

-- ============ ORDERS: commission / release ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS commission_mga BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_amount_mga BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_released BOOLEAN NOT NULL DEFAULT false;

-- ============ APP SETTINGS ============
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.04,
  auto_release_days INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings read" ON public.app_settings;
CREATE POLICY "settings read" ON public.app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "settings admin write" ON public.app_settings;
CREATE POLICY "settings admin write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.app_settings (id, commission_rate, auto_release_days) VALUES (1, 0.04, 10)
  ON CONFLICT (id) DO NOTHING;

-- ============ WITHDRAWALS ============
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_mga BIGINT NOT NULL CHECK (amount_mga > 0),
  method TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT,
  status deposit_status NOT NULL DEFAULT 'en_attente',
  admin_note TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own withdrawals" ON public.withdrawals;
CREATE POLICY "own withdrawals" ON public.withdrawals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin update withdrawals" ON public.withdrawals;
CREATE POLICY "admin update withdrawals" ON public.withdrawals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PLACE ORDER (with commission + pending) ============
CREATE OR REPLACE FUNCTION public.place_order(_product_id uuid, _quantity integer, _address text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p RECORD; _total BIGINT; _buyer UUID; _order_id UUID;
  _rate NUMERIC; _days INT; _commission BIGINT; _vendor_amt BIGINT;
  _admin_id UUID;
BEGIN
  _buyer := auth.uid();
  IF _buyer IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT commission_rate, auto_release_days INTO _rate, _days FROM public.app_settings WHERE id=1;
  SELECT * INTO _p FROM public.products WHERE id=_product_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not available'; END IF;
  IF _p.stock < _quantity THEN RAISE EXCEPTION 'insufficient stock'; END IF;
  _total := _p.price_mga * _quantity;
  _commission := FLOOR(_total * _rate)::BIGINT;
  _vendor_amt := _total - _commission;

  IF (SELECT balance_mga FROM public.wallets WHERE user_id=_buyer) < _total THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  -- Debit client available + increment lifetime spent
  UPDATE public.wallets
     SET balance_mga = balance_mga - _total,
         balance_spent_mga = balance_spent_mga + _total,
         updated_at = now()
   WHERE user_id = _buyer;

  -- Credit vendor PENDING (locked until release)
  INSERT INTO public.wallets (user_id, balance_mga, balance_pending_mga)
    VALUES (_p.vendor_id, 0, _vendor_amt)
    ON CONFLICT (user_id) DO UPDATE
      SET balance_pending_mga = wallets.balance_pending_mga + _vendor_amt,
          updated_at = now();

  -- Credit commission to ALL admins (first admin found owns the commission wallet)
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
      _quantity, _p.price_mga, _total, _address, 'paye',
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
END; $$;
REVOKE EXECUTE ON FUNCTION public.place_order(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, integer, text) TO authenticated;

-- ============ RELEASE (internal) ============
CREATE OR REPLACE FUNCTION public._release_order(_order_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id=_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.vendor_released THEN RETURN; END IF;
  UPDATE public.wallets
     SET balance_pending_mga = GREATEST(0, balance_pending_mga - _o.vendor_amount_mga),
         balance_mga = balance_mga + _o.vendor_amount_mga,
         updated_at = now()
   WHERE user_id = _o.vendor_id;
  UPDATE public.orders
     SET vendor_released = true, released_at = now(), status = 'livre'
   WHERE id = _order_id;
  INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
    VALUES (_o.vendor_id, 'vendor_release', _o.vendor_amount_mga, _order_id, 'Débloqué: ' || COALESCE(_reason,'auto'));
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_o.vendor_id, 'Fonds débloqués 💰', _o.product_title, '/vendeur');
END; $$;

-- ============ CLIENT CONFIRM DELIVERY ============
CREATE OR REPLACE FUNCTION public.confirm_delivery(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id=_order_id;
  IF _o.client_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _o.vendor_released THEN RAISE EXCEPTION 'already released'; END IF;
  UPDATE public.orders SET buyer_confirmed_at = now() WHERE id=_order_id;
  PERFORM public._release_order(_order_id, 'Confirmation client');
END; $$;
REVOKE EXECUTE ON FUNCTION public.confirm_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_delivery(uuid) TO authenticated;

-- ============ ADMIN RELEASE ============
CREATE OR REPLACE FUNCTION public.admin_release_order(_order_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._release_order(_order_id, COALESCE(_note,'Validation admin'));
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_release_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_release_order(uuid, text) TO authenticated;

-- ============ AUTO-RELEASE (cron) ============
CREATE OR REPLACE FUNCTION public.auto_release_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r RECORD; _n INT := 0;
BEGIN
  FOR _r IN SELECT id FROM public.orders
    WHERE vendor_released=false AND auto_release_at IS NOT NULL AND auto_release_at < now()
      AND status NOT IN ('annule','rembourse')
  LOOP
    PERFORM public._release_order(_r.id, 'Auto 10j');
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $$;

-- ============ WITHDRAWAL REQUEST (vendor) ============
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount bigint, _method text, _account text, _holder text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF NOT has_role(_uid, 'vendeur') THEN RAISE EXCEPTION 'vendor only'; END IF;
  IF (SELECT balance_mga FROM public.wallets WHERE user_id=_uid) < _amount THEN
    RAISE EXCEPTION 'insufficient available balance';
  END IF;
  UPDATE public.wallets SET balance_mga = balance_mga - _amount, updated_at=now() WHERE user_id=_uid;
  INSERT INTO public.withdrawals (user_id, amount_mga, method, account_number, account_holder)
    VALUES (_uid, _amount, _method, _account, _holder) RETURNING id INTO _id;
  INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
    VALUES (_uid, 'retrait', -_amount, _id, 'Demande de retrait ' || _method);
  RETURN _id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(bigint, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(bigint, text, text, text) TO authenticated;

-- ============ ADMIN VALIDATE WITHDRAWAL ============
CREATE OR REPLACE FUNCTION public.admin_validate_withdrawal(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _w RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id=_id AND status='en_attente' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF _approve THEN
    UPDATE public.withdrawals SET status='valide', admin_note=_note, reviewed_at=now() WHERE id=_id;
    INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (_w.user_id, 'Retrait validé ✅', _w.amount_mga || ' MGA envoyés via ' || _w.method, '/vendeur');
  ELSE
    UPDATE public.withdrawals SET status='rejete', admin_note=_note, reviewed_at=now() WHERE id=_id;
    -- Refund vendor available
    UPDATE public.wallets SET balance_mga = balance_mga + _w.amount_mga, updated_at=now() WHERE user_id=_w.user_id;
    INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
      VALUES (_w.user_id, 'retrait_refus', _w.amount_mga, _id, 'Retrait refusé: ' || COALESCE(_note,''));
    INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (_w.user_id, 'Retrait refusé ❌', COALESCE(_note,'Retrait rejeté'), '/vendeur');
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_validate_withdrawal(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_validate_withdrawal(uuid, boolean, text) TO authenticated;

-- ============ ADMIN INTERNAL TRANSFER (commission <-> funds) ============
CREATE OR REPLACE FUNCTION public.admin_transfer_funds(_direction text, _amount bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _direction = 'comm_to_funds' THEN
    IF (SELECT balance_commission_mga FROM public.wallets WHERE user_id=_uid) < _amount THEN
      RAISE EXCEPTION 'insufficient commission'; END IF;
    UPDATE public.wallets SET balance_commission_mga = balance_commission_mga - _amount,
      balance_admin_funds_mga = balance_admin_funds_mga + _amount, updated_at=now() WHERE user_id=_uid;
  ELSIF _direction = 'funds_to_comm' THEN
    IF (SELECT balance_admin_funds_mga FROM public.wallets WHERE user_id=_uid) < _amount THEN
      RAISE EXCEPTION 'insufficient funds'; END IF;
    UPDATE public.wallets SET balance_admin_funds_mga = balance_admin_funds_mga - _amount,
      balance_commission_mga = balance_commission_mga + _amount, updated_at=now() WHERE user_id=_uid;
  ELSE RAISE EXCEPTION 'invalid direction'; END IF;
  INSERT INTO public.wallet_transactions (user_id, type, amount_mga, description)
    VALUES (_uid, 'transfert_admin', _amount, 'Transfert ' || _direction);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_transfer_funds(text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_transfer_funds(text, bigint) TO authenticated;

-- ============ ADMIN SEND TO CLIENT ============
CREATE OR REPLACE FUNCTION public.admin_send_to_client(_client_id uuid, _amount bigint, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF (SELECT balance_admin_funds_mga FROM public.wallets WHERE user_id=_uid) < _amount THEN
    RAISE EXCEPTION 'insufficient admin funds';
  END IF;
  UPDATE public.wallets SET balance_admin_funds_mga = balance_admin_funds_mga - _amount, updated_at=now() WHERE user_id=_uid;
  INSERT INTO public.wallets (user_id, balance_mga) VALUES (_client_id, _amount)
    ON CONFLICT (user_id) DO UPDATE SET balance_mga = wallets.balance_mga + _amount, updated_at=now();
  INSERT INTO public.wallet_transactions (user_id, type, amount_mga, description)
    VALUES (_uid, 'envoi_admin', -_amount, 'Envoi à client: ' || COALESCE(_note,''));
  INSERT INTO public.wallet_transactions (user_id, type, amount_mga, description)
    VALUES (_client_id, 'envoi_admin', _amount, 'Reçu admin: ' || COALESCE(_note,''));
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_client_id, 'Crédit reçu 💰', _amount || ' MGA crédités. ' || COALESCE(_note,''), '/client');
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_send_to_client(uuid, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_to_client(uuid, bigint, text) TO authenticated;

-- ============ pg_cron auto-release hourly ============
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='auto-release-orders') THEN
    PERFORM cron.schedule('auto-release-orders', '0 * * * *', $cron$ SELECT public.auto_release_orders(); $cron$);
  END IF;
END $$;
