import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useOpenTicketsCount() {
  return useQuery({
    queryKey: ['open-tickets-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tickets_suporte')
        .select('*', { count: 'exact', head: true })
        .in('status', ['aberto', 'em_andamento']);
      
      if (error) throw error;
      return count || 0;
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 3,
    refetchOnWindowFocus: false,
  });
}
