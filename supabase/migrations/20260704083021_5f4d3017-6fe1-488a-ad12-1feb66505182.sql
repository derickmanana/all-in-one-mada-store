ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'unité';
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS shipping_zones jsonb NOT NULL DEFAULT '[]'::jsonb;