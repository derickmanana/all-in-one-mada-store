
REVOKE ALL ON FUNCTION public.feed_products(text, uuid, text, bigint, bigint, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_products(text, uuid, text, bigint, bigint, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.grant_loyalty_coupons() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_loyalty_coupons() TO authenticated;
