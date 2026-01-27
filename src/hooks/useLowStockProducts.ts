import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

const LOW_STOCK_THRESHOLD = 5;
const CRITICAL_STOCK_THRESHOLD = 2;

export interface LowStockProduct extends Product {
  stockLevel: 'critical' | 'low';
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ['low-stock-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .lte('stock', LOW_STOCK_THRESHOLD)
        .eq('is_active', true)
        .order('stock', { ascending: true });
      
      if (error) throw error;
      
      const productsWithLevel: LowStockProduct[] = (data || []).map(product => ({
        ...product,
        stockLevel: (product.stock || 0) <= CRITICAL_STOCK_THRESHOLD ? 'critical' : 'low',
      }));
      
      return productsWithLevel;
    },
    staleTime: 1000 * 60 * 2, // Cache por 2 minutos
    refetchInterval: 1000 * 60 * 5, // Refetch a cada 5 minutos
  });
}

export function useLowStockCount() {
  const { data: products } = useLowStockProducts();
  
  const criticalCount = products?.filter(p => p.stockLevel === 'critical').length || 0;
  const lowCount = products?.filter(p => p.stockLevel === 'low').length || 0;
  const totalCount = products?.length || 0;
  
  return { criticalCount, lowCount, totalCount };
}
