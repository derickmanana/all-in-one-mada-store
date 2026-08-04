-- 1. Revoke EXECUTE from PUBLIC/anon on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public._release_order(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auto_release_orders() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.compute_shipping_quote(uuid, double precision, double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_product_click(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_product_view(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_order(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vendor_mark_in_transit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vendor_ship_order(uuid, text, text, text, text, timestamptz, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vendor_update_shipping(uuid, timestamptz, integer, integer, text, text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.compute_shipping_quote(uuid, double precision, double precision) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_product_click(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_product_view(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_mark_in_transit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_ship_order(uuid, text, text, text, text, timestamptz, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_update_shipping(uuid, timestamptz, integer, integer, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._release_order(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_release_orders() TO service_role;

-- 2. Pin search_path on remaining mutable functions
ALTER FUNCTION public.haversine_km(double precision, double precision, double precision, double precision) SET search_path = public;
ALTER FUNCTION public.validate_address_mg() SET search_path = public;

-- 3. Remove permissive realtime subscribe policy
DROP POLICY IF EXISTS "authenticated realtime read" ON realtime.messages;