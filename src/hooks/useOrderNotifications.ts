import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function useOrderNotifications() {
  const queryClient = useQueryClient();
  const isInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (isInitialized.current) return;
    isInitialized.current = true;

    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const newOrder = payload.new as { order_number: string; total: number; source: string };
          
          const formatCurrency = (value: number) =>
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

          const sourceLabel = newOrder.source === 'pdv' ? '🏪 Loja' : '🌐 Site';
          
          // Show toast notification
          toast.success('Novo Pedido!', {
            description: `${sourceLabel} - ${newOrder.order_number} - ${formatCurrency(newOrder.total)}`,
            duration: 8000,
            action: {
              label: 'Ver Pedidos',
              onClick: () => {
                window.location.href = '/admin/pedidos';
              },
            },
          });

          // Play notification sound
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1sb2htc3eBi5GMh3xwaGVpcoGMlpWOf3JmYWVzgpGamJKEd2xnZm93hJOdnJaKfHFqaWxyfYmUnJqVioB1b2xscneAiZKWlpKMhH15dnV1eH6EjJGSj4uGgX17enl6fIGGi42NjIqGgn9+fX19foGEiIqLioiGhIKAgH5+f4GDhoeIiIeGhIKBgH9/gIGDhYaGhoWEg4KBgICAgoOEhYWFhISDgoGBgYGCgoOEhISEg4OCgoGBgYKCg4OEhIODg4KCgYGBgoKDg4ODg4OCgoKBgYGCgoKDg4ODgoKCgoGBgYKCgoODg4ODgoKCgYGBgoKCg4ODg4KCgoKBgYGCgoKDg4ODgoKCgoGBgYKCgoODg4OCgoKCgYGBgoKCgoODg4KCgoKBgYGCgoKCg4ODgoKCgoGBgYKCgoKDg4OCgoKCgYGBgoKCgoODg4KCgoKBgYGCgoKCg4ODgoKCgoGBgQ==');
            audio.volume = 0.3;
            audio.play().catch(() => {});
          } catch {
            // Audio not supported
          }

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
          queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
        }
      )
      .subscribe();

    return () => {
      isInitialized.current = false;
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
