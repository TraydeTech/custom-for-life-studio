import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  CalendarIcon, 
  Download, 
  TrendingUp, 
  ShoppingCart, 
  DollarSign,
  Package
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { Tables } from '@/integrations/supabase/types';

type Order = Tables<'orders'>;
type OrderItem = Tables<'order_items'>;

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function AdminRelatorios() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['report-orders', dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', startOfDay(dateRange.from).toISOString())
        .lte('created_at', endOfDay(dateRange.to).toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Order[];
    },
  });

  const { data: orderItems } = useQuery({
    queryKey: ['report-order-items', dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!orders?.length) return [];
      const orderIds = orders.map(o => o.id);
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);
      if (error) throw error;
      return data as OrderItem[];
    },
    enabled: !!orders?.length,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!orders) return { totalRevenue: 0, orderCount: 0, avgOrderValue: 0, productsSold: 0 };
    
    const paidOrders = orders.filter(o => o.payment_status === 'paid' || o.status === 'delivered');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = orders.length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / paidOrders.length : 0;
    const productsSold = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

    return { totalRevenue, orderCount, avgOrderValue, productsSold };
  }, [orders, orderItems]);

  // Daily sales data for line chart
  const dailySalesData = useMemo(() => {
    if (!orders) return [];
    
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    
    return days.map(day => {
      const dayOrders = orders.filter(o => {
        const orderDate = parseISO(o.created_at);
        return format(orderDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });
      
      const paidOrders = dayOrders.filter(o => o.payment_status === 'paid' || o.status === 'delivered');
      
      return {
        date: format(day, 'dd/MM', { locale: ptBR }),
        fullDate: format(day, 'dd/MM/yyyy', { locale: ptBR }),
        vendas: paidOrders.reduce((sum, o) => sum + o.total, 0),
        pedidos: dayOrders.length,
      };
    });
  }, [orders, dateRange]);

  // Sales by source (PDV vs Site)
  const salesBySource = useMemo(() => {
    if (!orders) return [];
    
    const pdvOrders = orders.filter(o => o.source === 'pdv');
    const siteOrders = orders.filter(o => o.source !== 'pdv');
    
    return [
      { name: 'Loja (PDV)', value: pdvOrders.reduce((sum, o) => sum + o.total, 0), count: pdvOrders.length },
      { name: 'Site', value: siteOrders.reduce((sum, o) => sum + o.total, 0), count: siteOrders.length },
    ];
  }, [orders]);

  // Top products
  const topProducts = useMemo(() => {
    if (!orderItems) return [];
    
    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    
    orderItems.forEach(item => {
      const existing = productMap.get(item.product_name);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.total_price;
      } else {
        productMap.set(item.product_name, {
          name: item.product_name,
          quantity: item.quantity,
          revenue: item.total_price,
        });
      }
    });
    
    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [orderItems]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleExportExcel = () => {
    if (!orders) return;

    // Prepare orders data
    const ordersData = orders.map(o => ({
      'Número do Pedido': o.order_number,
      'Data': format(parseISO(o.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      'Origem': o.source === 'pdv' ? 'Loja (PDV)' : 'Site',
      'Status': o.status,
      'Status Pagamento': o.payment_status,
      'Subtotal': o.subtotal,
      'Frete': o.shipping_cost || 0,
      'Desconto': o.discount || 0,
      'Total': o.total,
    }));

    // Prepare summary data
    const summaryData = [
      { 'Métrica': 'Faturamento Total', 'Valor': metrics.totalRevenue },
      { 'Métrica': 'Quantidade de Pedidos', 'Valor': metrics.orderCount },
      { 'Métrica': 'Ticket Médio', 'Valor': metrics.avgOrderValue },
      { 'Métrica': 'Produtos Vendidos', 'Valor': metrics.productsSold },
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add sheets
    const ordersSheet = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, ordersSheet, 'Pedidos');
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumo');

    if (topProducts.length > 0) {
      const productsSheet = XLSX.utils.json_to_sheet(topProducts.map(p => ({
        'Produto': p.name,
        'Quantidade Vendida': p.quantity,
        'Receita': p.revenue,
      })));
      XLSX.utils.book_append_sheet(wb, productsSheet, 'Top Produtos');
    }

    // Download
    const fileName = `relatorio-vendas-${format(dateRange.from, 'dd-MM-yyyy')}-a-${format(dateRange.to, 'dd-MM-yyyy')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-heading font-bold">Relatórios de Vendas</h1>
              <p className="text-muted-foreground">Análise de performance e métricas do período</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} - {format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    locale={ptBR}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              
              <Button onClick={handleExportExcel} disabled={!orders?.length}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">No período selecionado</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.orderCount}</div>
                <p className="text-xs text-muted-foreground">Total de pedidos</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(metrics.avgOrderValue)}</div>
                <p className="text-xs text-muted-foreground">Valor médio por pedido</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Produtos Vendidos</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.productsSold}</div>
                <p className="text-xs text-muted-foreground">Unidades vendidas</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sales Over Time */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Vendas por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Carregando...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailySalesData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => `R$ ${value}`}
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Vendas']}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="vendas" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Sales by Source */}
            <Card>
              <CardHeader>
                <CardTitle>Vendas por Origem</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={salesBySource}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {salesBySource.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {salesBySource.map((source, i) => (
                    <div key={source.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: CHART_COLORS[i] }}
                        />
                        <span>{source.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(source.value)}</span>
                        <span className="text-muted-foreground ml-2">({source.count} pedidos)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle>Top 5 Produtos</CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Nenhum produto vendido no período
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        type="number"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => `R$ ${value}`}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={120}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
