ALTER TABLE public.orders ADD CONSTRAINT orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendor_profiles(id) ON DELETE RESTRICT;
NOTIFY pgrst, 'reload schema';