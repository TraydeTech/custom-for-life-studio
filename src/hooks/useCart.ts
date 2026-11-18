import { useEffect } from 'react';
import { canMergeCartItems, selectedCartProduct, type CartVariant } from '@/lib/cart';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  getGuestCart, saveGuestCart, clearGuestCart, addGuestCartItem,
  type GuestCartItem,
} from '@/lib/guestCart';

export interface CartItem {
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
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images: string[];
    stock: number;
    product_variants?: CartVariant[];
  };
}

export interface AddToCartParams {
  productId: string;
  quantity?: number;
  customizationNotes?: string;
  engravingText?: string;
  engravingPositionX?: number;
  engravingPositionY?: number;
  engravingPreviewImage?: string;
  productColor?: string;
  engravingFileUrl?: string;
}

export function useCart() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['guest-cart'] });
    };
    window.addEventListener('cfl-cart-updated', refresh);
    return () => window.removeEventListener('cfl-cart-updated', refresh);
  }, [queryClient]);

  // ── Carrinho logado (Supabase) ──────────────────────────────────────────────
  const { data: dbCartItems = [], isLoading: dbLoading } = useQuery({
    queryKey: ['cart', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id, product_id, quantity, customization_notes,
          engraving_text, engraving_position_x, engraving_position_y,
          engraving_preview_image, product_color, engraving_file_url,
          product:products (id, name, slug, price, images, stock, product_variants(color_name, stock, main_image))
        `)
        .eq('user_id', user.id);
      if (error) throw error;
      return (data as unknown as CartItem[]).map(item => ({
        ...item, product: item.product ? selectedCartProduct(item.product, item.product_color) : item.product,
      }));
    },
    enabled: !!user,
  });

  // ── Carrinho visitante (localStorage + busca de produtos) ───────────────────
  const { data: guestCartItems = [], isLoading: guestLoading } = useQuery({
    queryKey: ['guest-cart'],
    queryFn: async () => {
      const guestItems = getGuestCart();
      if (guestItems.length === 0) return [];

      const productIds = [...new Set(guestItems.map(i => i.product_id))];
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, price, images, stock, product_variants(color_name, stock, main_image)')
        .in('id', productIds);

      if (error) throw error;
      const productMap = new Map((products || []).map(p => [p.id, p]));

      return guestItems
        .map(item => ({
          ...item,
          product: productMap.has(item.product_id) ? selectedCartProduct(productMap.get(item.product_id)!, item.product_color) : null,
        }))
        .filter(item => !!item.product) as CartItem[];
    },
    // Removido o 'enabled: !user' para que os itens de visitante continuem
    // acessíveis durante a transição de login/sincronização.
    staleTime: 0,
  });

  // Durante a transição de login, se o carrinho do banco estiver vazio mas o de
  // visitante não, mostramos o de visitante para evitar que o carrinho "suma".
  const cartItems = user 
    ? [...dbCartItems, ...guestCartItems.filter(item => !dbCartItems.some(db => db.id === item.id))]
    : guestCartItems;
  const isLoading = user ? (dbLoading && guestCartItems.length === 0) : guestLoading;

  // ── addToCart ───────────────────────────────────────────────────────────────
  const addToCart = useMutation({
    mutationFn: async ({
      productId, quantity = 1, customizationNotes,
      engravingText, engravingPositionX, engravingPositionY,
      engravingPreviewImage, productColor, engravingFileUrl,
    }: AddToCartParams) => {
      // Validação de estoque — busca estoque atual e soma com o que já está no carrinho.
      const { data: stockProduct, error: stockErr } = await supabase
        .from('products')
        .select('stock, name, product_variants(color_name, stock, main_image)')
        .eq('id', productId)
        .maybeSingle();
      if (stockErr) throw stockErr;
      if (!stockProduct) throw new Error('Produto indisponível.');
      const availableStock = selectedCartProduct(stockProduct, productColor).stock;

      const currentInCart = cartItems
        .filter((i) => i.product_id === productId && (!stockProduct.product_variants?.length || i.product_color === productColor))
        .reduce((sum, i) => sum + i.quantity, 0);

      if (currentInCart + quantity > availableStock) {
        const remaining = Math.max(0, availableStock - currentInCart);
        throw new Error(
          remaining > 0
            ? `Quantidade indisponível em estoque. Restam apenas ${remaining} unidade(s) deste produto.`
            : 'Quantidade indisponível em estoque. Ajuste a quantidade para continuar.'
        );
      }

      if (!user) {
        // Visitante: salva no localStorage
        addGuestCartItem({
          product_id: productId,
          quantity,
          customization_notes: customizationNotes || null,
          engraving_text: engravingText || null,
          engraving_position_x: engravingPositionX ?? null,
          engraving_position_y: engravingPositionY ?? null,
          engraving_preview_image: engravingPreviewImage || null,
          product_color: productColor || null,
          engraving_file_url: engravingFileUrl || null,
        });
        return;
      }

      const configuration = {
        product_id: productId, product_color: productColor,
        customization_notes: customizationNotes, engraving_text: engravingText,
        engraving_file_url: engravingFileUrl, engraving_preview_image: engravingPreviewImage,
      };
      const { data: rows, error: lookupError } = await supabase.from('cart_items')
        .select('id, quantity, product_id, product_color, customization_notes, engraving_text, engraving_file_url, engraving_preview_image')
        .eq('user_id', user.id).eq('product_id', productId);
      if (lookupError) throw lookupError;
      const existing = rows?.find(item => canMergeCartItems(item, configuration));
      if (existing) {
        const { error } = await supabase.from('cart_items')
          .update({ quantity: existing.quantity + quantity }).eq('id', existing.id).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cart_items').insert({
          ...configuration, user_id: user.id, quantity,
          engraving_position_x: engravingPositionX, engraving_position_y: engravingPositionY,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['cart'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['guest-cart'] });
      }
      toast({ title: 'Produto adicionado', description: 'Item adicionado ao carrinho.' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erro', description: (error as Error).message });
    },
  });

  // ── updateQuantity ──────────────────────────────────────────────────────────
  const updateQuantity = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (!Number.isInteger(quantity)) throw new Error('Quantidade inválida.');
      const item = cartItems.find(row => row.id === itemId);
      if (quantity > 0 && item) {
        const { data: product, error } = await supabase.from('products')
          .select('stock, product_variants(color_name, stock, main_image)').eq('id', item.product_id).single();
        if (error) throw error;
        const stock = selectedCartProduct(product, item.product_color).stock;
        const otherQuantity = cartItems.filter(row => row.id !== itemId && row.product_id === item.product_id
          && (!product.product_variants?.length || row.product_color === item.product_color))
          .reduce((sum, row) => sum + row.quantity, 0);
        if (quantity + otherQuantity > stock) throw new Error('Quantidade indisponível para esta cor.');
      }
      if (!user || !dbCartItems.some(item => item.id === itemId)) {
        const items = getGuestCart();
        const updated = quantity <= 0
          ? items.filter(i => i.id !== itemId)
          : items.map(i => i.id === itemId ? { ...i, quantity } : i);
        saveGuestCart(updated);
        return;
      }
      if (quantity <= 0) {
        const { error } = await supabase.from('cart_items').delete().eq('id', itemId).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', itemId).eq('user_id', user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['guest-cart'] });
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Não foi possível atualizar', description: error.message }),
  });

  // ── removeFromCart ──────────────────────────────────────────────────────────
  const removeFromCart = useMutation({
    mutationFn: async (itemId: string) => {
      if (!user || !dbCartItems.some(item => item.id === itemId)) {
        const items = getGuestCart().filter(i => i.id !== itemId);
        saveGuestCart(items);
        return;
      }
      const { error } = await supabase.from('cart_items').delete().eq('id', itemId).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['guest-cart'] });
      toast({ title: 'Produto removido', description: 'Item removido do carrinho.' });
    },
  });

  // ── clearCart ───────────────────────────────────────────────────────────────
  const clearCart = useMutation({
    mutationFn: async () => {
      if (!user) { clearGuestCart(); return; }
      const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id);
      if (error) throw error;
      clearGuestCart();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['guest-cart'] });
    },
  });

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity, 0
  );

  return { cartItems, cartCount, cartTotal, isLoading, addToCart, updateQuantity, removeFromCart, clearCart };
}

// ── syncGuestCartToSupabase ─────────────────────────────────────────────────
// Chamado logo após o login para mover itens do localStorage para o banco
const cartSyncs = new Map<string, Promise<void>>();
export function syncGuestCartToSupabase(userId: string): Promise<void> {
  const running = cartSyncs.get(userId);
  if (running) return running;
  const run = (async () => {
    const guestItems = getGuestCart();
    if (!guestItems.length) return;
    // Stable guest UUIDs make retries safe after a lost response. Never clear
    // the local copy until the complete batch is acknowledged by Supabase.
    const { error } = await supabase.from('cart_items').upsert(
      guestItems.map(item => ({ ...item, user_id: userId })) as never,
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) throw error;
    const synced = new Map(guestItems.map(item => [item.id, item.quantity]));
    const remaining = getGuestCart().flatMap(item => {
      const quantity = synced.get(item.id);
      if (quantity === undefined) return [item];
      return item.quantity > quantity
        ? [{ ...item, id: crypto.randomUUID(), quantity: item.quantity - quantity }]
        : [];
    });
    saveGuestCart(remaining);
    window.dispatchEvent(new Event('cfl-cart-updated'));
  })();
  cartSyncs.set(userId, run);
  run.finally(() => cartSyncs.delete(userId)).catch(() => {});
  return run;
}
