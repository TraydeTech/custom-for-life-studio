export interface CartConfiguration {
  product_id: string;
  product_color?: string | null;
  engraving_text?: string | null;
  customization_notes?: string | null;
  engraving_file_url?: string | null;
  engraving_preview_image?: string | null;
}

// Personalizações ficam em linhas próprias. Somente itens simples da mesma
// cor podem compartilhar quantidade.
export function canMergeCartItems(a: CartConfiguration, b: CartConfiguration): boolean {
  const personalized = (item: CartConfiguration) => !!(
    item.engraving_text || item.customization_notes || item.engraving_file_url || item.engraving_preview_image
  );
  return a.product_id === b.product_id
    && (a.product_color || null) === (b.product_color || null)
    && !personalized(a) && !personalized(b);
}

export interface CartVariant {
  color_name: string;
  stock: number;
  main_image?: string | null;
}

export function selectedCartProduct<T extends { stock: number; images?: string[]; product_variants?: CartVariant[] }>(
  product: T, color?: string | null,
): T {
  if (!color || !product.product_variants?.length) return product;
  const variant = product.product_variants.find(v => v.color_name === color);
  return {
    ...product,
    stock: variant?.stock ?? 0,
    images: variant?.main_image ? [variant.main_image] : product.images,
  };
}
