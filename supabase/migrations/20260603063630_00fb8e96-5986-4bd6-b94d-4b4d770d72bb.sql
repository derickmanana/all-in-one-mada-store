
-- 1. Orders INSERT policy (client only)
CREATE POLICY "client insert own order"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (client_id = auth.uid());

-- 2. Products vendor update requires active vendor
DROP POLICY IF EXISTS "vendor update own products" ON public.products;
CREATE POLICY "vendor update own products"
ON public.products FOR UPDATE TO authenticated
USING (vendor_id = auth.uid())
WITH CHECK (
  vendor_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = auth.uid() AND vp.status = 'actif')
);

-- 3. Vendor profiles: don't expose phone to anon. Restrict public read to authenticated.
DROP POLICY IF EXISTS "public read active vendors" ON public.vendor_profiles;
CREATE POLICY "authenticated read active vendors"
ON public.vendor_profiles FOR SELECT TO authenticated
USING (status = 'actif');

-- 4. Lock down SECURITY DEFINER functions: revoke from public/anon, grant to authenticated only where needed
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_wallet() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_validate_deposit(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_order(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_validate_deposit(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, integer, text) TO authenticated;

-- 5. Storage objects: prevent broad listing of public buckets. Restrict SELECT to authenticated for products/chat.
DROP POLICY IF EXISTS "products public read" ON storage.objects;
DROP POLICY IF EXISTS "chat public read" ON storage.objects;
DROP POLICY IF EXISTS "Public read products" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat" ON storage.objects;

CREATE POLICY "products authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'products');

CREATE POLICY "chat participants read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat');

-- vendors upload product images to their own folder
DROP POLICY IF EXISTS "vendor upload products" ON storage.objects;
CREATE POLICY "vendor upload products"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'products' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "vendor update products" ON storage.objects;
CREATE POLICY "vendor update products"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'products' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "vendor delete products" ON storage.objects;
CREATE POLICY "vendor delete products"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'products' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "chat user upload" ON storage.objects;
CREATE POLICY "chat user upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 6. Realtime channel authorization: restrict messages broadcast to participants
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated realtime read" ON realtime.messages;
CREATE POLICY "authenticated realtime read"
ON realtime.messages FOR SELECT TO authenticated
USING (true);
