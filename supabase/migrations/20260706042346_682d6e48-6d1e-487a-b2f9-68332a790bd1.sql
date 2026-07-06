
-- Orders: tracking code + client hide
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS client_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.gen_tracking_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _code TEXT; _tries INT := 0;
BEGIN
  IF NEW.tracking_code IS NOT NULL THEN RETURN NEW; END IF;
  LOOP
    _code := 'AIO-' || upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE tracking_code = _code);
    _tries := _tries + 1;
    IF _tries > 5 THEN _code := 'AIO-' || upper(substring(md5(gen_random_uuid()::text || clock_timestamp()::text) from 1 for 8)); EXIT; END IF;
  END LOOP;
  NEW.tracking_code := _code;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_orders_tracking_code ON public.orders;
CREATE TRIGGER trg_orders_tracking_code
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.gen_tracking_code();

-- Backfill existing rows
UPDATE public.orders SET tracking_code = 'AIO-' || upper(substring(md5(id::text) from 1 for 6))
WHERE tracking_code IS NULL;

-- Products: engagement counters for AI ranking
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_product_view(_product_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.products SET view_count = view_count + 1 WHERE id = _product_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_product_click(_product_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.products SET click_count = click_count + 1 WHERE id = _product_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_product_view(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_product_click(UUID) TO anon, authenticated;
