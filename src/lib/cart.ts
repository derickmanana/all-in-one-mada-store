export type CartItem = {
  product_id: string;
  vendor_id: string;
  title: string;
  image: string | null;
  unit_price_mga: number;
  qty: number;
  color?: string | null;
  size?: string | null;
  /** unité / pointure / autre variante */
  unit?: string | null;
  /** sélectionné pour le paiement (défaut: true) */
  selected?: boolean;
};

const KEY = "dago_cart";

function emit() {
  window.dispatchEvent(new CustomEvent("dago-cart-changed"));
}

export function getCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as CartItem[]) : [];
    // rétro-compatibilité : les anciens articles n'ont pas de champ "selected"
    return list.map((i) => ({ ...i, selected: i.selected !== false }));
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  emit();
}

export function addToCart(item: CartItem) {
  const cart = getCart();
  const idx = cart.findIndex(
    (c) =>
      c.product_id === item.product_id &&
      (c.color ?? null) === (item.color ?? null) &&
      (c.size ?? null) === (item.size ?? null) &&
      (c.unit ?? null) === (item.unit ?? null),
  );
  if (idx >= 0) cart[idx].qty += item.qty;
  else cart.push({ ...item, selected: true });
  saveCart(cart);
}

export function updateQty(index: number, qty: number) {
  const cart = getCart();
  if (!cart[index]) return;
  if (qty <= 0) cart.splice(index, 1);
  else cart[index].qty = qty;
  saveCart(cart);
}

export function updateItem(index: number, patch: Partial<CartItem>) {
  const cart = getCart();
  if (!cart[index]) return;
  cart[index] = { ...cart[index], ...patch };
  saveCart(cart);
}

export function removeItem(index: number) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
}

export function toggleSelected(index: number) {
  const cart = getCart();
  if (!cart[index]) return;
  cart[index].selected = cart[index].selected === false;
  saveCart(cart);
}

export function setAllSelected(selected: boolean) {
  saveCart(getCart().map((i) => ({ ...i, selected })));
}

/** Retire du panier uniquement les articles passés en paramètre (par index) */
export function removeIndexes(indexes: number[]) {
  const set = new Set(indexes);
  saveCart(getCart().filter((_, i) => !set.has(i)));
}

export function selectedItems(items: CartItem[]): CartItem[] {
  return items.filter((i) => i.selected !== false);
}

export function clearCart() {
  saveCart([]);
}

// Auto bulk discount: -2% per item when qty>=10 of same product
export function lineUnitWithDiscount(item: CartItem): number {
  return item.qty >= 10 ? Math.floor(item.unit_price_mga * 0.98) : item.unit_price_mga;
}

export function lineTotal(item: CartItem): number {
  return lineUnitWithDiscount(item) * item.qty;
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + lineTotal(i), 0);
}
