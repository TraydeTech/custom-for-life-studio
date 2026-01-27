import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { LowStockAlert } from '@/components/admin/LowStockAlert';
import { useAdminStats } from '@/hooks/useAdminStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Package,
  TrendingUp,
  Clock
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-heading font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral do seu negócio</p>
          </div>

          {/* Low Stock Alert */}
          <LowStockAlert />

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-20 bg-muted rounded-t-lg" />
                  <CardContent className="h-16 bg-muted/50" />
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Cards de Métricas */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-primary">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Faturamento Total
                    </CardTitle>
                    <DollarSign className="h-5 w-5 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(stats?.totalRevenue || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <TrendingUp className="h-3 w-3 inline mr-1 text-green-500" />
                      Todos os pedidos pagos
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-secondary">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total de Pedidos
                    </CardTitle>
                    <ShoppingCart className="h-5 w-5 text-secondary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 inline mr-1 text-yellow-500" />
                      {stats?.pendingOrders || 0} pendentes
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-accent">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Clientes Cadastrados
                    </CardTitle>
                    <Users className="h-5 w-5 text-accent" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Usuários registrados
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Produtos Ativos
                    </CardTitle>
                    <Package className="h-5 w-5 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      No catálogo
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Faturamento Mensal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats?.monthlyRevenue || []}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis 
                            className="text-xs"
                            tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip 
                            formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            fill="url(#colorRevenue)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Pedidos por Mês</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.monthlyRevenue || []}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            formatter={(value: number) => [value, 'Pedidos']}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Bar 
                            dataKey="orders" 
                            fill="hsl(var(--secondary))" 
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
