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
          product:products (id, name, slug, price, images, stock)
        `)
        .eq('user_id', user.id);
      if (error) throw error;
      return data as unknown as CartItem[];
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
      const { data: products } = await supabase
        .from('products')
        .select('id, name, slug, price, images, stock')
        .in('id', productIds);

      const productMap = new Map((products || []).map(p => [p.id, p]));

      return guestItems
        .map(item => ({
          ...item,
          product: productMap.get(item.product_id) || null,
        }))
        .filter(item => !!item.product) as CartItem[];
    },
    enabled: !user,
    staleTime: 0,
  });

  const cartItems = user ? dbCartItems : guestCartItems;
  const isLoading = user ? dbLoading : guestLoading;

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
        .select('stock, name')
        .eq('id', productId)
        .maybeSingle();
      if (stockErr) throw stockErr;
      const availableStock = stockProduct?.stock ?? 0;

      const currentInCart = cartItems
        .filter((i) => i.product_id === productId)
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
          engraving_position_x: engravingPositionX || null,
          engraving_position_y: engravingPositionY || null,
          engraving_preview_image: engravingPreviewImage || null,
          product_color: productColor || null,
          engraving_file_url: engravingFileUrl || null,
        });
        return;
      }

      if (engravingText) {
        const { error } = await supabase.from('cart_items').insert({
          user_id: user.id, product_id: productId, quantity,
          customization_notes: customizationNotes,
          engraving_text: engravingText,
          engraving_position_x: engravingPositionX,
          engraving_position_y: engravingPositionY,
          engraving_preview_image: engravingPreviewImage,
          product_color: productColor,
          engraving_file_url: engravingFileUrl,
        } as any);
        if (error) throw error;
        return;
      }

      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .is('engraving_text' as any, null)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cart_items').insert({
          user_id: user.id, product_id: productId, quantity,
          customization_notes: customizationNotes, product_color: productColor,
        } as any);
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
      if (!user) {
        const items = getGuestCart();
        const updated = quantity <= 0
          ? items.filter(i => i.id !== itemId)
          : items.map(i => i.id === itemId ? { ...i, quantity } : i);
        saveGuestCart(updated);
        return;
      }
      if (quantity <= 0) {
        const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', itemId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: user ? ['cart'] : ['guest-cart'] });
    },
  });

  // ── removeFromCart ──────────────────────────────────────────────────────────
  const removeFromCart = useMutation({
    mutationFn: async (itemId: string) => {
      if (!user) {
        const items = getGuestCart().filter(i => i.id !== itemId);
        saveGuestCart(items);
        return;
      }
      const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: user ? ['cart'] : ['guest-cart'] });
      toast({ title: 'Produto removido', description: 'Item removido do carrinho.' });
    },
  });

  // ── clearCart ───────────────────────────────────────────────────────────────
  const clearCart = useMutation({
    mutationFn: async () => {
      if (!user) { clearGuestCart(); return; }
      const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: user ? ['cart'] : ['guest-cart'] });
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
export async function syncGuestCartToSupabase(userId: string): Promise<void> {
  const guestItems = getGuestCart();
  if (guestItems.length === 0) return;

  for (const item of guestItems) {
    try {
      if (item.engraving_text) {
        await supabase.from('cart_items').insert({
          user_id: userId, product_id: item.product_id, quantity: item.quantity,
          customization_notes: item.customization_notes,
          engraving_text: item.engraving_text,
          engraving_position_x: item.engraving_position_x,
          engraving_position_y: item.engraving_position_y,
          engraving_preview_image: item.engraving_preview_image,
          product_color: item.product_color,
        } as any);
        continue;
      }

      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', userId)
        .eq('product_id', item.product_id)
        .is('engraving_text' as any, null)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + item.quantity })
          .eq('id', existing.id);
      } else {
        await supabase.from('cart_items').insert({
          user_id: userId, product_id: item.product_id, quantity: item.quantity,
          customization_notes: item.customization_notes,
          product_color: item.product_color,
        } as any);
      }
    } catch {}
  }

  clearGuestCart();
}
