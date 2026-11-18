import { canMergeCartItems } from './cart';

export const GUEST_CART_KEY = 'cfl_guest_cart';

export interface GuestCartItem {
  id: string;
  product_id: string;
  quantity: number;
  customization_notes: string | null;
  engraving_text: string | null;
  engraving_position_x: number | null;
  engraving_position_y: number | null;
  engraving_preview_image: string | null;
  product_color: string | null;
  engraving_file_url: string | null;
}

export function getGuestCart(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGuestCart(items: GuestCartItem[]): void {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    throw new Error('Não foi possível salvar o carrinho neste navegador. Libere espaço e tente novamente.');
  }
}

export function clearGuestCart(): void {
  localStorage.removeItem(GUEST_CART_KEY);
}

export function addGuestCartItem(
  params: Omit<GuestCartItem, 'id'>
): GuestCartItem[] {
  const items = getGuestCart();

  const existing = items.find(item => canMergeCartItems(item, params));

  if (existing) {
    const updated = items.map(i =>
      i.id === existing.id ? { ...i, quantity: i.quantity + params.quantity } : i
    );
    saveGuestCart(updated);
    return updated;
  }

  const newItem: GuestCartItem = { id: crypto.randomUUID(), ...params };
  const updated = [...items, newItem];
  saveGuestCart(updated);
  return updated;
}
