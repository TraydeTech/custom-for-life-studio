import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

export interface PeriodComparison {
  currentMonth: {
    revenue: number;
    orders: number;
    avgTicket: number;
  };
  previousMonth: {
    revenue: number;
    orders: number;
    avgTicket: number;
  };
  revenueChange: number;
  ordersChange: number;
  avgTicketChange: number;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos (aumentado)
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Não recarregar ao montar se já tem cache
    queryFn: async () => {
      // Buscar total de pedidos e faturamento
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total, status, created_at, payment_status');

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
      const paidOrders = orders?.filter(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status) || o.payment_status === 'paid').length || 0;
      // Faturamento real: apenas pedidos com pagamento confirmado
      const totalRevenue = orders?.filter(o => o.payment_status === 'paid' || ['processing', 'shipped', 'delivered'].includes(o.status))
        .reduce((sum, order) => sum + Number(order.total), 0) || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;

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

      // Comparação mês atual vs mês anterior
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);
      const previousMonthStart = startOfMonth(subMonths(now, 1));
      const previousMonthEnd = endOfMonth(subMonths(now, 1));

      const currentMonthOrders = orders?.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= currentMonthStart && orderDate <= currentMonthEnd;
      }) || [];

      const previousMonthOrders = orders?.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= previousMonthStart && orderDate <= previousMonthEnd;
      }) || [];

      // Calculate paid orders only for accurate revenue
      const currentPaidOrders = currentMonthOrders.filter(o => 
        o.payment_status === 'paid' || o.status === 'delivered'
      );
      const previousPaidOrders = previousMonthOrders.filter(o => 
        o.payment_status === 'paid' || o.status === 'delivered'
      );

      const currentRevenue = currentPaidOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const previousRevenue = previousPaidOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const currentOrderCount = currentMonthOrders.length;
      const previousOrderCount = previousMonthOrders.length;
      const currentAvgTicket = currentPaidOrders.length > 0 ? currentRevenue / currentPaidOrders.length : 0;
      const previousAvgTicket = previousPaidOrders.length > 0 ? previousRevenue / previousPaidOrders.length : 0;

      // Calculate percentage changes
      const calculateChange = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const periodComparison: PeriodComparison = {
        currentMonth: {
          revenue: currentRevenue,
          orders: currentOrderCount,
          avgTicket: currentAvgTicket,
        },
        previousMonth: {
          revenue: previousRevenue,
          orders: previousOrderCount,
          avgTicket: previousAvgTicket,
        },
        revenueChange: calculateChange(currentRevenue, previousRevenue),
        ordersChange: calculateChange(currentOrderCount, previousOrderCount),
        avgTicketChange: calculateChange(currentAvgTicket, previousAvgTicket),
      };

      return {
        totalOrders,
        totalRevenue,
        totalCustomers: totalCustomers || 0,
        totalProducts: totalProducts || 0,
        pendingOrders,
        paidOrders,
        monthlyRevenue,
        periodComparison,
      };
    },
  });
}
