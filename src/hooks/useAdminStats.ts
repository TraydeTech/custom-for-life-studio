import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Buscar total de pedidos e faturamento
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total, status, created_at');

      if (ordersError) throw ordersError;

      // Buscar total de clientes (profiles)
      const { count: totalCustomers, error: customersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (customersError) throw customersError;

      // Buscar total de produtos
      const { count: totalProducts, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      if (productsError) throw productsError;

      // Calcular métricas
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
      const paidOrders = orders?.filter(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status)).length || 0;

      // Faturamento por mês (últimos 6 meses)
      const monthlyRevenue: { month: string; revenue: number; orders: number }[] = [];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = date.toISOString();
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();
        
        const monthOrders = orders?.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= new Date(monthStart) && orderDate <= new Date(monthEnd);
        }) || [];

        monthlyRevenue.push({
          month: date.toLocaleDateString('pt-BR', { month: 'short' }),
          revenue: monthOrders.reduce((sum, o) => sum + Number(o.total), 0),
          orders: monthOrders.length,
        });
      }

      return {
        totalOrders,
        totalRevenue,
        totalCustomers: totalCustomers || 0,
        totalProducts: totalProducts || 0,
        pendingOrders,
        paidOrders,
        monthlyRevenue,
      };
    },
  });
}
