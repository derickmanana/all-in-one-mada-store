export type CartItem = {
  product_id: string;
  vendor_id: string;
  title: string;
  image: string | null;
  unit_price_mga: number;
  qty: number;
  color?: string | null;
  size?: string | null;
};

const KEY = "dago_cart";

function emit() {
  window.dispatchEvent(new CustomEvent("dago-cart-changed"));
}

export function getCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
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
    (c) => c.product_id === item.product_id && c.color === item.color && c.size === item.size,
  );
  if (idx >= 0) cart[idx].qty += item.qty;
  else cart.push(item);
  saveCart(cart);
}

export function updateQty(index: number, qty: number) {
  const cart = getCart();
  if (qty <= 0) cart.splice(index, 1);
  else cart[index].qty = qty;
  saveCart(cart);
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
