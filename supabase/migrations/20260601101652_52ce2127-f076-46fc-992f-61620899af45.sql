
-- 1. Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'vendeur', 'client');
CREATE TYPE public.vendor_status AS ENUM ('en_attente', 'actif', 'rejete');

-- 2. user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 4. client profiles
CREATE TABLE public.client_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.client_profiles TO authenticated;
GRANT ALL ON public.client_profiles TO service_role;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- 5. vendor profiles
CREATE TABLE public.vendor_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  logo_url TEXT,
  banner_url TEXT,
  description TEXT,
  address TEXT,
  status public.vendor_status NOT NULL DEFAULT 'en_attente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.vendor_profiles TO authenticated;
GRANT SELECT ON public.vendor_profiles TO anon;
GRANT ALL ON public.vendor_profiles TO service_role;
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies
-- user_roles
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- client_profiles
CREATE POLICY "client read own" ON public.client_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "client insert own" ON public.client_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "client update own" ON public.client_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "admin read clients" ON public.client_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- vendor_profiles
CREATE POLICY "vendor read own" ON public.vendor_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "public read active vendors" ON public.vendor_profiles FOR SELECT TO anon, authenticated USING (status = 'actif');
CREATE POLICY "vendor insert own" ON public.vendor_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "vendor update own" ON public.vendor_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "admin manage vendors" ON public.vendor_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. Auto-create profile + role on signup based on user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role TEXT;
BEGIN
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');

  IF _role = 'vendeur' THEN
    INSERT INTO public.vendor_profiles (id, shop_name, phone, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'shop_name', 'Boutique'),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      'en_attente'
    );
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendeur') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.client_profiles (id, full_name, phone, address)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Client'),
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'address'
    );
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Bootstrap ADMIN account (unique, hidden)
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'rasolonjatovojeannoel21@gmail.com';
  IF admin_id IS NULL THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      'rasolonjatovojeannoel21@gmail.com',
      crypt('@madaga2100', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"admin"}'::jsonb,
      '', '', '', ''
    );
  END IF;

  -- Ensure admin role exists
  INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'admin') ON CONFLICT DO NOTHING;
END $$;
