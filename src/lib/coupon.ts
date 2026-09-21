import type { CartItem } from "@/lib/cart";

export type Coupon = {
  id: string;
  code: string;
  percent: number;
  product_id: string | null;
  category_id: string | null;
  reason: string | null;
  expires_at: string;
  used_at: string | null;
};

const KEY = "dago_coupon";

export function getSelectedCouponId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setSelectedCouponId(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("dago-coupon-changed"));
}

export type Eligibility = { ok: boolean; reason?: string; lineIndex?: number };

/**
 * Vérifie si un coupon peut s'appliquer aux articles sélectionnés.
 * categoryOf : product_id -> category_id
 */
export function checkCoupon(
  coupon: Coupon,
  items: CartItem[],
  categoryOf: Record<string, string | null>,
): Eligibility {
  if (coupon.used_at) return { ok: false, reason: "Ce coupon a déjà été utilisé." };
  if (new Date(coupon.expires_at).getTime() <= Date.now())
    return { ok: false, reason: "Ce coupon est expiré." };
  if (items.length === 0)
    return { ok: false, reason: "Sélectionnez au moins un produit dans le panier." };

  const matches = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => {
      if (coupon.product_id) return it.product_id === coupon.product_id;
      if (coupon.category_id) return categoryOf[it.product_id] === coupon.category_id;
      return true;
    });

  if (matches.length === 0) {
    return {
      ok: false,
      reason: coupon.product_id
        ? "Ce coupon ne concerne pas les produits sélectionnés."
        : "Aucun produit sélectionné n'appartient à la catégorie du coupon.",
    };
  }

  // La réduction s'applique à la ligne éligible la plus avantageuse
  let best = matches[0];
  for (const m of matches) {
    const t = m.it.unit_price_mga * m.it.qty;
    if (t > best.it.unit_price_mga * best.it.qty) best = m;
  }
  return { ok: true, lineIndex: best.i };
}
