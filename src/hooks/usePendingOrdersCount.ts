import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePendingOrdersCount() {
  return useQuery({
    queryKey: ['pending-orders-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'paid', 'processing']);
      
      if (error) throw error;
      return count || 0;
    },
    staleTime: 1000 * 60 * 2, // Cache por 2 minutos (aumentado)
    refetchInterval: 1000 * 60 * 3, // Refetch a cada 3 minutos
    refetchOnWindowFocus: false,
  });
}
