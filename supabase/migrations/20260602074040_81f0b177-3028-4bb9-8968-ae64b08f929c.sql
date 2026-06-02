
-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "admin manage categories" ON public.categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.categories (name, slug, icon) VALUES
  ('Mode', 'mode', '👗'),('Électronique', 'electronique', '📱'),
  ('Maison', 'maison', '🏠'),('Beauté', 'beaute', '💄'),
  ('Alimentation', 'alimentation', '🍎'),('Sports', 'sports', '⚽');

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  category_id uuid REFERENCES public.categories(id),
  title text NOT NULL,
  description text,
  price_mga bigint NOT NULL CHECK (price_mga >= 0),
  price_usdt numeric(12,2),
  stock int NOT NULL DEFAULT 0 CHECK (stock >= 0),
  images text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_vendor ON public.products(vendor_id);
CREATE INDEX idx_products_category ON public.products(category_id);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read active" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "vendor read own products" ON public.products FOR SELECT TO authenticated USING (vendor_id = auth.uid());
CREATE POLICY "vendor insert own products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (vendor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.vendor_profiles WHERE id = auth.uid() AND status = 'actif'));
CREATE POLICY "vendor update own products" ON public.products FOR UPDATE TO authenticated USING (vendor_id = auth.uid());
CREATE POLICY "vendor delete own products" ON public.products FOR DELETE TO authenticated USING (vendor_id = auth.uid());
CREATE POLICY "admin manage products" ON public.products FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============ WALLET ============
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY,
  balance_mga bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet read own" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin read wallets" ON public.wallets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TYPE public.deposit_status AS ENUM ('en_attente', 'valide', 'rejete');
CREATE TABLE public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_mga bigint NOT NULL CHECK (amount_mga > 0),
  method text NOT NULL,
  proof_url text NOT NULL,
  reference text,
  status public.deposit_status NOT NULL DEFAULT 'en_attente',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX idx_deposits_user ON public.deposits(user_id);
GRANT SELECT, INSERT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposit insert own" ON public.deposits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "deposit read own" ON public.deposits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin manage deposits" ON public.deposits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TYPE public.tx_type AS ENUM ('depot', 'achat', 'vente', 'remboursement', 'commission');
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.tx_type NOT NULL,
  amount_mga bigint NOT NULL,
  reference_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_user ON public.wallet_transactions(user_id);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx read own" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin read tx" ON public.wallet_transactions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ============ ORDERS ============
CREATE TYPE public.order_status AS ENUM ('en_attente', 'paye', 'expedie', 'livre', 'annule', 'rembourse');
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_title text NOT NULL,
  product_image text,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price_mga bigint NOT NULL,
  total_mga bigint NOT NULL,
  status public.order_status NOT NULL DEFAULT 'en_attente',
  shipping_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_client ON public.orders(client_id);
CREATE INDEX idx_orders_vendor ON public.orders(vendor_id);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order client read" ON public.orders FOR SELECT TO authenticated USING (client_id = auth.uid());
CREATE POLICY "order vendor read" ON public.orders FOR SELECT TO authenticated USING (vendor_id = auth.uid());
CREATE POLICY "order vendor update" ON public.orders FOR UPDATE TO authenticated USING (vendor_id = auth.uid());
CREATE POLICY "admin manage orders" ON public.orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============ MESSAGING ============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, vendor_id)
);
GRANT SELECT, INSERT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv participants read" ON public.conversations FOR SELECT TO authenticated
  USING (client_id = auth.uid() OR vendor_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "conv client insert" ON public.conversations FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_conv ON public.messages(conversation_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg participants read" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
    AND (c.client_id = auth.uid() OR c.vendor_id = auth.uid() OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "msg sender insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
    AND (c.client_id = auth.uid() OR c.vendor_id = auth.uid())));

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- ============ SUPPORT TICKETS ============
CREATE TYPE public.ticket_status AS ENUM ('ouvert', 'en_cours', 'resolu', 'ferme');
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  category text NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'ouvert',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket own read" ON public.tickets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ticket own insert" ON public.tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin manage tickets" ON public.tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TABLE public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tmsg owner read" ON public.ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "tmsg sender insert" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, is_read);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif own read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif own update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============ TRIGGER: create wallet on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance_mga) VALUES (NEW.id, 0) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- Extend handle_new_user to also create wallet
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role TEXT;
BEGIN
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  IF _role = 'vendeur' THEN
    INSERT INTO public.vendor_profiles (id, shop_name, phone, status)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'shop_name', 'Boutique'),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''), 'en_attente');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendeur') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.client_profiles (id, full_name, phone, address)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Client'),
      NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'address');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.wallets (user_id, balance_mga) VALUES (NEW.id, 0) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RPC: validate deposit & credit wallet ============
CREATE OR REPLACE FUNCTION public.admin_validate_deposit(_deposit_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _d FROM public.deposits WHERE id = _deposit_id AND status = 'en_attente' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deposit not found or already processed'; END IF;
  IF _approve THEN
    UPDATE public.deposits SET status = 'valide', admin_note = _note, reviewed_at = now() WHERE id = _deposit_id;
    INSERT INTO public.wallets (user_id, balance_mga) VALUES (_d.user_id, _d.amount_mga)
      ON CONFLICT (user_id) DO UPDATE SET balance_mga = wallets.balance_mga + _d.amount_mga, updated_at = now();
    INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
      VALUES (_d.user_id, 'depot', _d.amount_mga, _d.id, 'Dépôt validé');
    INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (_d.user_id, 'Dépôt validé ✅', 'Votre dépôt de ' || _d.amount_mga || ' MGA a été crédité.', '/client/wallet');
  ELSE
    UPDATE public.deposits SET status = 'rejete', admin_note = _note, reviewed_at = now() WHERE id = _deposit_id;
    INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (_d.user_id, 'Dépôt rejeté ❌', COALESCE(_note, 'Votre dépôt a été rejeté.'), '/client/wallet');
  END IF;
END; $$;

-- ============ RPC: place order (debit buyer, credit seller) ============
CREATE OR REPLACE FUNCTION public.place_order(_product_id uuid, _quantity int, _address text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p RECORD; _total bigint; _buyer uuid; _order_id uuid;
BEGIN
  _buyer := auth.uid();
  IF _buyer IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _p FROM public.products WHERE id = _product_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not available'; END IF;
  IF _p.stock < _quantity THEN RAISE EXCEPTION 'insufficient stock'; END IF;
  _total := _p.price_mga * _quantity;
  IF (SELECT balance_mga FROM public.wallets WHERE user_id = _buyer) < _total THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;
  UPDATE public.wallets SET balance_mga = balance_mga - _total, updated_at = now() WHERE user_id = _buyer;
  UPDATE public.wallets SET balance_mga = balance_mga + _total, updated_at = now() WHERE user_id = _p.vendor_id;
  UPDATE public.products SET stock = stock - _quantity WHERE id = _product_id;
  INSERT INTO public.orders (client_id, vendor_id, product_id, product_title, product_image, quantity, unit_price_mga, total_mga, shipping_address, status)
    VALUES (_buyer, _p.vendor_id, _p.id, _p.title, COALESCE(_p.images[1], NULL), _quantity, _p.price_mga, _total, _address, 'paye')
    RETURNING id INTO _order_id;
  INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
    VALUES (_buyer, 'achat', -_total, _order_id, 'Achat: ' || _p.title);
  INSERT INTO public.wallet_transactions (user_id, type, amount_mga, reference_id, description)
    VALUES (_p.vendor_id, 'vente', _total, _order_id, 'Vente: ' || _p.title);
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_p.vendor_id, 'Nouvelle commande 🛍️', _p.title || ' x' || _quantity, '/vendeur');
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_buyer, 'Commande confirmée ✅', _p.title, '/client/orders');
  RETURN _order_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_validate_deposit TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order TO authenticated;

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('proofs', 'proofs', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat', 'chat', true) ON CONFLICT DO NOTHING;

CREATE POLICY "products public read" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "products vendor upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "products vendor delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'products' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "proofs owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));
CREATE POLICY "proofs owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "chat public read" ON storage.objects FOR SELECT USING (bucket_id = 'chat');
CREATE POLICY "chat user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat' AND auth.uid()::text = (storage.foldername(name))[1]);
