import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
}

export function useCart() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cartItems = [], isLoading } = useQuery({
    queryKey: ['cart', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          product_id,
          quantity,
          customization_notes,
          engraving_text,
          engraving_position_x,
          engraving_position_y,
          engraving_preview_image,
          product_color,
          product:products (
            id,
            name,
            slug,
            price,
            images,
            stock
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      return data as unknown as CartItem[];
    },
    enabled: !!user,
  });

  const addToCart = useMutation({
    mutationFn: async ({ 
      productId, 
      quantity = 1, 
      customizationNotes,
      engravingText,
      engravingPositionX,
      engravingPositionY,
      engravingPreviewImage,
      productColor,
    }: AddToCartParams) => {
      if (!user) throw new Error('Usuário não autenticado');

      // If has engraving, always insert new (don't merge with existing)
      if (engravingText) {
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: productId,
            quantity,
            customization_notes: customizationNotes,
            engraving_text: engravingText,
            engraving_position_x: engravingPositionX,
            engraving_position_y: engravingPositionY,
            engraving_preview_image: engravingPreviewImage,
            product_color: productColor,
          } as any);
        if (error) throw error;
        return;
      }

      // Check if item already in cart (no engraving)
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
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: productId,
            quantity,
            customization_notes: customizationNotes,
            product_color: productColor,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast({
        title: 'Produto adicionado',
        description: 'O produto foi adicionado ao carrinho.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    },
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (quantity <= 0) {
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('id', itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity })
          .eq('id', itemId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const removeFromCart = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast({
        title: 'Produto removido',
        description: 'O produto foi removido do carrinho.',
      });
    },
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity, 
    0
  );

  return {
    cartItems,
    cartCount,
    cartTotal,
    isLoading,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  };
}
