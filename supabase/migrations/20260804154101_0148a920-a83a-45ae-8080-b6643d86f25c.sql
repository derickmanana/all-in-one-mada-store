
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_active_stock ON public.products (is_active, stock) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_sold ON public.products (sold_count DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_user_created ON public.user_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_user_cat ON public.user_events (user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_user_events_user_prod ON public.user_events (user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_user ON public.product_likes (user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_client ON public.orders (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupons_user_active ON public.coupons (user_id, expires_at) WHERE used_at IS NULL;

CREATE OR REPLACE FUNCTION public.feed_products(_tab text DEFAULT 'pour_toi'::text, _category uuid DEFAULT NULL::uuid, _q text DEFAULT NULL::text, _min_price bigint DEFAULT NULL::bigint, _max_price bigint DEFAULT NULL::bigint, _limit integer DEFAULT 24, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, title text, price_mga bigint, images text[], category_id uuid, discount_percent smallint, promo_until timestamp with time zone, sold_count bigint, view_count bigint, click_count bigint, created_at timestamp with time zone, final_price_mga bigint, score double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _events int := 0;
  _orders int := 0;
  _avg_price numeric := NULL;
  _known boolean := false;
  _max_sold bigint := 1;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT count(*), avg(NULLIF(price_mga,0)) INTO _events, _avg_price
      FROM public.user_events WHERE user_id = _uid AND created_at > now() - interval '120 days';
    SELECT count(*) INTO _orders FROM public.orders WHERE client_id = _uid;
    IF _avg_price IS NULL THEN
      SELECT avg(unit_price_mga) INTO _avg_price FROM public.orders WHERE client_id = _uid;
    END IF;
  END IF;
  -- "Client régulier" = assez de signaux comportementaux
  _known := (_events >= 8 OR _orders >= 1);

  SELECT GREATEST(1, COALESCE(max(p.sold_count),1)) INTO _max_sold
    FROM public.products p WHERE p.is_active = true AND p.stock > 0;

  RETURN QUERY
  WITH prefs AS (
    -- Affinité catégorie pondérée par type d'événement + temps passé
    SELECT e.category_id AS cid,
           sum(
             CASE e.event_type
               WHEN 'purchase' THEN 10
               WHEN 'click' THEN 3
               WHEN 'search' THEN 2
               WHEN 'view' THEN 1
               ELSE 1
             END
             * exp(-EXTRACT(epoch FROM (now() - e.created_at)) / (86400.0 * 45))
             + LEAST(COALESCE(e.dwell_ms,0) / 5000.0, 4)
           )::double precision AS w
      FROM public.user_events e
     WHERE _uid IS NOT NULL AND e.user_id = _uid AND e.category_id IS NOT NULL
       AND e.created_at > now() - interval '120 days'
     GROUP BY e.category_id
  ),
  order_cats AS (
    SELECT p.category_id AS cid, count(*)::double precision AS w
      FROM public.orders o JOIN public.products p ON p.id = o.product_id
     WHERE _uid IS NOT NULL AND o.client_id = _uid AND p.category_id IS NOT NULL
     GROUP BY p.category_id
  ),
  aff AS (
    SELECT cid, sum(w) AS w FROM (
      SELECT cid, w FROM prefs
      UNION ALL SELECT cid, w * 8 FROM order_cats
    ) u GROUP BY cid
  ),
  aff_max AS (SELECT GREATEST(1, COALESCE(max(w), 1)) AS m FROM aff),
  favs AS (
    SELECT l.product_id FROM public.product_likes l
     WHERE _uid IS NOT NULL AND l.user_id = _uid
  ),
  seen AS (
    SELECT e.product_id, sum(LEAST(COALESCE(e.dwell_ms,0)/1000.0, 60))::double precision AS dwell
      FROM public.user_events e
     WHERE _uid IS NOT NULL AND e.user_id = _uid AND e.product_id IS NOT NULL
       AND e.created_at > now() - interval '120 days'
     GROUP BY e.product_id
  ),
  base AS (
    SELECT p.id, p.title, p.price_mga, p.images, p.category_id,
           p.discount_percent, p.promo_until, p.sold_count,
           p.view_count, p.click_count, p.created_at,
           CASE WHEN p.discount_percent > 0 AND (p.promo_until IS NULL OR p.promo_until > now())
                THEN floor(p.price_mga * (100 - p.discount_percent) / 100.0)::bigint
                ELSE p.price_mga END AS final_price_mga,
           COALESCE((SELECT a.w / (SELECT m FROM aff_max) FROM aff a WHERE a.cid = p.category_id), 0) AS affinity,
           (EXISTS (SELECT 1 FROM favs f WHERE f.product_id = p.id)) AS is_fav,
           COALESCE((SELECT s.dwell FROM seen s WHERE s.product_id = p.id), 0) AS dwell_s
      FROM public.products p
     WHERE p.is_active = true AND p.stock > 0
       AND (_category IS NULL OR p.category_id = _category)
       AND (_q IS NULL OR _q = '' OR p.title ILIKE '%'||_q||'%' OR COALESCE(p.description,'') ILIKE '%'||_q||'%')
  ),
  filtered AS (
    SELECT b.* FROM base b
     WHERE (_min_price IS NULL OR b.final_price_mga >= _min_price)
       AND (_max_price IS NULL OR b.final_price_mga <= _max_price)
       AND CASE _tab
             WHEN 'promos' THEN b.discount_percent > 0 AND (b.promo_until IS NULL OR b.promo_until > now())
             WHEN 'flash' THEN b.discount_percent >= 20 AND b.promo_until IS NOT NULL AND b.promo_until > now()
             WHEN 'nouveautes' THEN b.created_at > now() - interval '21 days'
             WHEN 'bon_marche' THEN b.final_price_mga <= 20000
             WHEN 'coupons' THEN EXISTS (
                SELECT 1 FROM public.coupons c
                 WHERE c.user_id = _uid AND c.used_at IS NULL AND c.expires_at > now()
                   AND (c.product_id = b.id OR (c.product_id IS NULL AND (c.category_id IS NULL OR c.category_id = b.category_id))))
             ELSE true
           END
  ),
  ranked AS (
    SELECT f.*,
      -- nouveau client : rang du prix croissant à l'intérieur de chaque catégorie
      row_number() OVER (PARTITION BY f.category_id ORDER BY f.final_price_mga ASC) AS cheap_rank
      FROM filtered f
  )
  SELECT r.id, r.title, r.price_mga, r.images, r.category_id,
         r.discount_percent, r.promo_until, r.sold_count,
         r.view_count, r.click_count, r.created_at, r.final_price_mga,
         (
           CASE _tab
             WHEN 'tendance' THEN ln(1 + r.click_count) * 40 + ln(1 + r.view_count) * 20 + r.sold_count * 8
             WHEN 'nouveautes' THEN 100 - EXTRACT(epoch FROM (now() - r.created_at)) / 86400.0
             WHEN 'bon_marche' THEN 200.0 / GREATEST(r.cheap_rank, 1)
             WHEN 'promos' THEN r.discount_percent * 10 + ln(1 + r.click_count) * 5
             WHEN 'flash' THEN r.discount_percent * 10 + ln(1 + r.view_count) * 5
             ELSE 0
           END
           -- Best-sellers : normalisé, toujours présent
           + 60.0 * (r.sold_count::double precision / _max_sold)
           + ln(1 + r.click_count) * 4 + ln(1 + r.view_count) * 2
           + CASE WHEN r.discount_percent > 0 THEN r.discount_percent * 1.2 ELSE 0 END
           + CASE WHEN _known THEN
               -- Client régulier : personnalisation forte
                 r.affinity * 120
               + CASE WHEN r.is_fav THEN 80 ELSE 0 END
               + LEAST(r.dwell_s, 60) * 0.8
               + CASE WHEN _avg_price IS NOT NULL
                      THEN 45 * exp(-abs(r.final_price_mga - _avg_price) / GREATEST(_avg_price, 1))
                      ELSE 0 END
             ELSE
               -- Nouveau client : les moins chers d'abord, équilibrés par catégorie
                 220.0 / GREATEST(r.cheap_rank, 1)
             END
         )::double precision AS score
    FROM ranked r
   ORDER BY score DESC, r.final_price_mga ASC
   LIMIT GREATEST(1, LEAST(_limit, 60)) OFFSET GREATEST(0, _offset);
END; $function$;

CREATE OR REPLACE FUNCTION public.grant_loyalty_coupons()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _activity int; _orders int; _spent bigint; _pct smallint;
  _cat uuid; _prod uuid; _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RETURN 0; END IF;
  -- un seul coupon actif à la fois
  IF EXISTS (SELECT 1 FROM public.coupons WHERE user_id=_uid AND used_at IS NULL AND expires_at > now()) THEN
    RETURN 0;
  END IF;
  -- pas plus d'un coupon tous les 7 jours
  SELECT max(created_at) INTO _last FROM public.coupons WHERE user_id=_uid;
  IF _last IS NOT NULL AND _last > now() - interval '7 days' THEN RETURN 0; END IF;

  SELECT count(*) INTO _activity FROM public.user_events
   WHERE user_id=_uid AND created_at > now() - interval '30 days';
  SELECT count(*), COALESCE(sum(total_mga),0) INTO _orders, _spent
    FROM public.orders WHERE client_id=_uid;

  -- seuil d'activité minimal
  IF _activity < 10 AND _orders < 1 THEN RETURN 0; END IF;

  -- 1% de base, jusqu'à 5% selon l'activité, les commandes et le montant dépensé
  _pct := LEAST(5, GREATEST(1,
            1 + (_activity / 40) + _orders + (_spent / 500000)::int))::smallint;

  -- Produit préféré (le plus consulté/cliqué et non encore acheté), sinon catégorie préférée
  SELECT e.product_id INTO _prod
    FROM public.user_events e
    JOIN public.products p ON p.id = e.product_id AND p.is_active AND p.stock > 0
   WHERE e.user_id=_uid AND e.product_id IS NOT NULL
     AND e.created_at > now() - interval '45 days'
     AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.client_id=_uid AND o.product_id=e.product_id)
   GROUP BY e.product_id
   ORDER BY count(*) DESC, sum(COALESCE(e.dwell_ms,0)) DESC
   LIMIT 1;

  IF _prod IS NULL THEN
    SELECT category_id INTO _cat FROM public.user_events
     WHERE user_id=_uid AND category_id IS NOT NULL AND created_at > now() - interval '60 days'
     GROUP BY category_id ORDER BY count(*) DESC LIMIT 1;
  END IF;

  INSERT INTO public.coupons (user_id, code, percent, product_id, category_id, reason, expires_at)
  VALUES (_uid, 'AIO-' || upper(substring(md5(gen_random_uuid()::text) from 1 for 7)),
          _pct, _prod, _cat,
          'Fidélité IA: ' || _activity || ' interactions, ' || _orders || ' commandes',
          now() + interval '14 days');

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_uid, 'Coupon fidélité 🎫',
          'Vous avez gagné -' || _pct || '% sur vos produits préférés.', '/client');
  RETURN 1;
END; $function$;
