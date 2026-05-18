import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, Pie, PieChart, Cell, ResponsiveContainer } from 'recharts';
import {
  TrendingUp, TrendingDown, Plus, CheckCircle, Clock, AlertCircle,
  DollarSign, Calendar, Eye, CreditCard, Banknote, Store, Globe,
  Package, QrCode, Download
} from 'lucide-react';
import { format, subDays, startOfDay, startOfMonth, startOfYear, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

const PIE_COLORS = ['hsl(var(--primary))', '#8b5cf6', '#3b82f6', '#10b981'];

function FinanceiroContent() {
  const queryClient = useQueryClient();
  const [isPayableDialogOpen, setIsPayableDialogOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [newPayable, setNewPayable] = useState({
    description: '', amount: '', due_date: '', supplier_name: '', category: '', notes: ''
  });

  // Fetch financial transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ['financial-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions' as any)
        .select('*, orders(order_number, shipping_address, notes, user_id)')
        .order('transaction_date', { ascending: false });
      if (error) throw error;

      // Get customer names
      const userIds = (data || []).map((t: any) => t.orders?.user_id).filter(Boolean);
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: p } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        profiles = p || [];
      }

      return (data || []).map((t: any) => {
        const profile = profiles.find((p: any) => p.user_id === t.orders?.user_id);
        let customerName = profile?.full_name;
        if (!customerName && t.orders?.notes) {
          const match = t.orders.notes.match(/Cliente:\s*([^|]+)/i);
          if (match) customerName = match[1].trim();
        }
        return { ...t, customer_name: customerName || 'Cliente' };
      });
    },
  });

  // Fetch receivables and payables
  const { data: receivables = [], isLoading: loadingReceivables } = useQuery({
    queryKey: ['accounts_receivable'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts_receivable').select('*').order('due_date', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: payables = [], isLoading: loadingPayables } = useQuery({
    queryKey: ['accounts_payable'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts_payable').select('*').order('due_date', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // Order details query
  const { data: orderDetails, isLoading: loadingOrder } = useQuery({
    queryKey: ['order_details', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const { data: order } = await supabase.from('orders').select('id, order_number, payment_method, payment_status, source, total, created_at, shipping_address, user_id, notes').eq('id', selectedOrderId).maybeSingle();
      if (!order) return null;
      let customerName: string | null = null;
      if (order.user_id) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', order.user_id).maybeSingle();
        if (profile?.full_name) customerName = profile.full_name;
      }
      if (!customerName && order.notes) {
        const match = order.notes.match(/Cliente:\s*([^|]+)/i);
        if (match) customerName = match[1].trim();
      }
      const { data: items } = await supabase.from('order_items').select('id, product_name, product_image, quantity, unit_price, total_price').eq('order_id', selectedOrderId);
      return { ...order, customer_name: customerName, order_items: items || [] };
    },
    enabled: !!selectedOrderId
  });

  const createPayableMutation = useMutation({
    mutationFn: async (data: typeof newPayable) => {
      const { error } = await supabase.from('accounts_payable').insert({
        description: data.description, amount: parseFloat(data.amount),
        due_date: data.due_date, supplier_name: data.supplier_name || null,
        category: data.category || null, notes: data.notes || null, status: 'pending'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts_payable'] });
      setIsPayableDialogOpen(false);
      setNewPayable({ description: '', amount: '', due_date: '', supplier_name: '', category: '', notes: '' });
      toast.success('Conta a pagar criada!');
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async ({ table, id }: { table: 'accounts_receivable' | 'accounts_payable', id: string }) => {
      const { error } = await supabase.from(table).update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.table] });
      toast.success('Marcado como pago!');
    }
  });

  // Computed stats
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = startOfMonth(now);
    const yearStart = startOfYear(now);

    const paidTx = transactions.filter((t: any) => t.status === 'confirmed');
    const todayTx = paidTx.filter((t: any) => new Date(t.transaction_date) >= todayStart);
    const monthTx = paidTx.filter((t: any) => new Date(t.transaction_date) >= monthStart);
    const yearTx = paidTx.filter((t: any) => new Date(t.transaction_date) >= yearStart);

    const todayTotal = todayTx.reduce((s: number, t: any) => s + Number(t.net_amount), 0);
    const monthTotal = monthTx.reduce((s: number, t: any) => s + Number(t.net_amount), 0);
    const yearTotal = yearTx.reduce((s: number, t: any) => s + Number(t.net_amount), 0);
    const avgTicket = monthTx.length > 0 ? monthTotal / monthTx.length : 0;
    const pendingReceivable = receivables.filter((r: any) => r.status !== 'paid').reduce((s: number, r: any) => s + Number(r.amount), 0);

    const monthGross = monthTx.reduce((s: number, t: any) => s + Number(t.gross_amount), 0);
    const monthFees = monthTx.reduce((s: number, t: any) => s + Number(t.gateway_fee), 0);
    const monthNet = monthTx.reduce((s: number, t: any) => s + Number(t.net_amount), 0);

    return { todayTotal, monthTotal, yearTotal, avgTicket, monthSales: monthTx.length, pendingReceivable, monthGross, monthFees, monthNet };
  }, [transactions, receivables]);

  // Chart data: daily revenue last 30 days
  const dailyChartData = useMemo(() => {
    const days: { date: string; revenue: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayTx = transactions.filter((t: any) => t.status === 'confirmed' && format(new Date(t.transaction_date), 'yyyy-MM-dd') === dateStr);
      days.push({ date: format(d, 'dd/MM'), revenue: dayTx.reduce((s: number, t: any) => s + Number(t.net_amount), 0) });
    }
    return days;
  }, [transactions]);

  // Pie: payment method distribution
  const paymentPieData = useMemo(() => {
    const methods: Record<string, number> = {};
    transactions.filter((t: any) => t.status === 'confirmed').forEach((t: any) => {
      const m = t.payment_method || 'outro';
      methods[m] = (methods[m] || 0) + Number(t.gross_amount);
    });
    return Object.entries(methods).map(([name, value]) => ({
      name: name === 'pix' ? 'PIX' : name === 'credito' ? 'Crédito' : name === 'debito' ? 'Débito' : name === 'dinheiro' ? 'Dinheiro' : name,
      value: Math.round(value * 100) / 100,
    }));
  }, [transactions]);

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status !== 'paid';
    if (status === 'paid') return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Pago</Badge>;
    if (isOverdue) return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Vencido</Badge>;
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
  };

  const getPaymentIcon = (method: string | null) => {
    if (method === 'pix') return <QrCode className="h-4 w-4 text-primary" />;
    if (method === 'credito') return <CreditCard className="h-4 w-4 text-purple-400" />;
    if (method === 'debito') return <CreditCard className="h-4 w-4 text-blue-400" />;
    return <Banknote className="h-4 w-4 text-green-400" />;
  };

  const totalReceivable = receivables.filter((r: any) => r.status !== 'paid').reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalPayable = payables.filter((p: any) => p.status !== 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalReceived = receivables.filter((r: any) => r.status === 'paid').reduce((s: number, r: any) => s + Number(r.amount), 0);

  const handleExportCSV = () => {
    const rows = transactions.map((t: any) => [
      format(new Date(t.transaction_date), 'dd/MM/yyyy HH:mm'),
      t.orders?.order_number || '-',
      t.customer_name,
      t.payment_method,
      t.installments || 1,
      Number(t.gross_amount).toFixed(2),
      Number(t.gateway_fee).toFixed(2),
      Number(t.net_amount).toFixed(2),
      t.status,
    ].join(';'));
    const header = 'Data;Pedido;Cliente;Método;Parcelas;Bruto;Taxa;Líquido;Status';
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground">Visão completa das finanças da loja</p>
        </div>
        <Button variant="outline" onClick={handleExportCSV} className="gap-2">
          <Download className="h-4 w-4" />Exportar CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Hoje</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-primary">{formatCurrency(stats.todayTotal)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Este Mês</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-primary">{formatCurrency(stats.monthTotal)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Este Ano</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(stats.yearTotal)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Ticket Médio</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(stats.avgTicket)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Vendas no Mês</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{stats.monthSales}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Em Aberto</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-amber-500">{formatCurrency(stats.pendingReceivable)}</div></CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Receita Diária (últimos 30 dias)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ revenue: { label: 'Receita', color: 'hsl(var(--primary))' } }} className="h-[200px]">
              <BarChart data={dailyChartData}>
                <XAxis dataKey="date" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} tickLine={false} tickFormatter={v => `R$${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Por Método de Pagamento</CardTitle></CardHeader>
          <CardContent>
            {paymentPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={paymentPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {paymentPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-muted-foreground text-sm">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fee Summary */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Resumo de Taxas do Mês</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-xs text-muted-foreground">Total Bruto</p><p className="text-lg font-bold">{formatCurrency(stats.monthGross)}</p></div>
            <div><p className="text-xs text-muted-foreground">Taxas Gateway</p><p className="text-lg font-bold text-destructive">-{formatCurrency(stats.monthFees)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total Líquido</p><p className="text-lg font-bold text-primary">{formatCurrency(stats.monthNet)}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Lançamentos ({transactions.length})</TabsTrigger>
          <TabsTrigger value="receivables">A Receber ({receivables.length})</TabsTrigger>
          <TabsTrigger value="payables">A Pagar ({payables.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardContent className="pt-6">
              {transactions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum lançamento</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead>Bruto</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead>Líquido</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{format(new Date(t.transaction_date), 'dd/MM/yy HH:mm')}</TableCell>
                        <TableCell className="font-mono text-xs">{t.orders?.order_number || '-'}</TableCell>
                        <TableCell className="text-sm">{t.customer_name}</TableCell>
                        <TableCell><div className="flex items-center gap-1">{getPaymentIcon(t.payment_method)}<span className="text-xs capitalize">{t.payment_method}</span></div></TableCell>
                        <TableCell className="text-center">{t.installments || 1}x</TableCell>
                        <TableCell>{formatCurrency(Number(t.gross_amount))}</TableCell>
                        <TableCell className="text-destructive text-xs">-{formatCurrency(Number(t.gateway_fee))}</TableCell>
                        <TableCell className="font-semibold text-primary">{formatCurrency(Number(t.net_amount))}</TableCell>
                        <TableCell>
                          {t.status === 'confirmed' ? <Badge className="bg-green-500/20 text-green-400 text-xs">Confirmado</Badge> :
                           t.status === 'refunded' ? <Badge variant="destructive" className="text-xs">Estornado</Badge> :
                           <Badge variant="secondary" className="text-xs">{t.status}</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receivables">
          <Card>
            <CardHeader><CardTitle>Contas a Receber</CardTitle><p className="text-sm text-muted-foreground">Vendas do site e PDV aparecem automaticamente</p></CardHeader>
            <CardContent>
              {loadingReceivables ? <p className="text-center py-8 text-muted-foreground">Carregando...</p> : receivables.length === 0 ? <p className="text-center py-8 text-muted-foreground">Nenhuma conta a receber</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Cliente</TableHead><TableHead>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {receivables.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{item.customer_name || '-'}</TableCell>
                        <TableCell className="text-green-500 font-semibold">{formatCurrency(Number(item.amount))}</TableCell>
                        <TableCell>{format(new Date(item.due_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                        <TableCell>{getStatusBadge(item.status, item.due_date)}</TableCell>
                        <TableCell className="space-x-2">
                          {item.order_id && <Button size="sm" variant="ghost" onClick={() => { setSelectedOrderId(item.order_id); setIsDetailsOpen(true); }}><Eye className="w-4 h-4 mr-1" />Detalhes</Button>}
                          {item.status !== 'paid' && <Button size="sm" variant="outline" onClick={() => markAsPaidMutation.mutate({ table: 'accounts_receivable', id: item.id })}><CheckCircle className="w-4 h-4 mr-1" />Recebido</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payables">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Contas a Pagar</CardTitle><p className="text-sm text-muted-foreground">Gerencie suas despesas</p></div>
              <Dialog open={isPayableDialogOpen} onOpenChange={setIsPayableDialogOpen}>
                <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova Conta</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
                  <form onSubmit={e => { e.preventDefault(); createPayableMutation.mutate(newPayable); }} className="space-y-4">
                    <div><Label>Descrição *</Label><Input value={newPayable.description} onChange={e => setNewPayable(p => ({ ...p, description: e.target.value }))} required /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Valor *</Label><Input type="number" step="0.01" min="0" value={newPayable.amount} onChange={e => setNewPayable(p => ({ ...p, amount: e.target.value }))} required /></div>
                      <div><Label>Vencimento *</Label><Input type="date" value={newPayable.due_date} onChange={e => setNewPayable(p => ({ ...p, due_date: e.target.value }))} required /></div>
                    </div>
                    <div><Label>Fornecedor</Label><Input value={newPayable.supplier_name} onChange={e => setNewPayable(p => ({ ...p, supplier_name: e.target.value }))} /></div>
                    <div><Label>Categoria</Label>
                      <Select value={newPayable.category} onValueChange={v => setNewPayable(p => ({ ...p, category: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fornecedores">Fornecedores</SelectItem>
                          <SelectItem value="aluguel">Aluguel</SelectItem>
                          <SelectItem value="utilidades">Utilidades</SelectItem>
                          <SelectItem value="salarios">Salários</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Observações</Label><Textarea value={newPayable.notes} onChange={e => setNewPayable(p => ({ ...p, notes: e.target.value }))} /></div>
                    <Button type="submit" className="w-full" disabled={createPayableMutation.isPending}>{createPayableMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingPayables ? <p className="text-center py-8 text-muted-foreground">Carregando...</p> : payables.length === 0 ? <p className="text-center py-8 text-muted-foreground">Nenhuma conta a pagar</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Fornecedor</TableHead><TableHead>Categoria</TableHead><TableHead>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {payables.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{item.supplier_name || '-'}</TableCell>
                        <TableCell>{item.category || '-'}</TableCell>
                        <TableCell className="text-red-500 font-semibold">{formatCurrency(Number(item.amount))}</TableCell>
                        <TableCell>{format(new Date(item.due_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                        <TableCell>{getStatusBadge(item.status, item.due_date)}</TableCell>
                        <TableCell>{item.status !== 'paid' && <Button size="sm" variant="outline" onClick={() => markAsPaidMutation.mutate({ table: 'accounts_payable', id: item.id })}><CheckCircle className="w-4 h-4 mr-1" />Pago</Button>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Detalhes da Venda</DialogTitle></DialogHeader>
          {loadingOrder ? (
            <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : orderDetails ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Pedido</p><p className="font-semibold">{orderDetails.order_number}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Cliente</p><p className="font-semibold">{orderDetails.customer_name || 'Cliente'}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Data</p><p className="font-semibold">{format(new Date(orderDetails.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Pagamento</p><div className="flex items-center gap-2">{getPaymentIcon(orderDetails.payment_method)}<span className="font-semibold capitalize">{orderDetails.payment_method || 'Não informado'}</span></div></div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4" />Produtos</h4>
                {orderDetails.order_items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="w-16 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0 border">
                      {item.product_image ? (
                        <img 
                          src={item.product_image} 
                          alt={item.product_name} 
                          className="w-full h-full object-contain cursor-pointer hover:opacity-80 transition-opacity" 
                          onClick={() => setZoomedImage(item.product_image)}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package className="h-6 w-6" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0"><p className="font-medium truncate">{item.product_name}</p><p className="text-sm text-muted-foreground">{item.quantity}x {formatCurrency(Number(item.unit_price))}</p></div>
                    <div className="text-right"><p className="font-semibold text-primary">{formatCurrency(Number(item.total_price))}</p></div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(Number(orderDetails.total))}</span>
              </div>
            </div>
          ) : <p className="text-center py-8 text-muted-foreground">Detalhes não encontrados</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Visualização da Imagem</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4 bg-white">
            {zoomedImage && (
              <img 
                src={zoomedImage} 
                alt="Zoom" 
                className="max-w-full max-h-[70vh] object-contain" 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Financeiro() {
  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <FinanceiroContent />
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
