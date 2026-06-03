
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_url text;

CREATE TABLE IF NOT EXISTS public.product_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.product_likes TO authenticated;
GRANT SELECT ON public.product_likes TO anon;
GRANT ALL ON public.product_likes TO service_role;

ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes public read" ON public.product_likes FOR SELECT USING (true);
CREATE POLICY "likes user insert" ON public.product_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes user delete" ON public.product_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.product_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  user_id uuid NOT NULL,
  author_name text,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.product_comments TO authenticated;
GRANT SELECT ON public.product_comments TO anon;
GRANT ALL ON public.product_comments TO service_role;

ALTER TABLE public.product_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments public read" ON public.product_comments FOR SELECT USING (true);
CREATE POLICY "comments user insert" ON public.product_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments author delete" ON public.product_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_product_likes_product ON public.product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_comments_product ON public.product_comments(product_id);
