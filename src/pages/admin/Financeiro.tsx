import { useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  DollarSign,
  Calendar,
  Eye,
  CreditCard,
  Banknote,
  Store,
  Globe,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

type OrderItem = {
  id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type OrderDetails = {
  id: string;
  order_number: string;
  payment_method: string | null;
  payment_status: string | null;
  source: string | null;
  total: number;
  created_at: string;
  customer_name: string | null;
  order_items: OrderItem[];
};

type AccountReceivable = {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  order_id: string | null;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
};

type AccountPayable = {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  supplier_name: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
};

function FinanceiroContent() {
  const queryClient = useQueryClient();
  const [isPayableDialogOpen, setIsPayableDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [newPayable, setNewPayable] = useState({
    description: '',
    amount: '',
    due_date: '',
    supplier_name: '',
    category: '',
    notes: ''
  });

  // Buscar detalhes do pedido
  const { data: orderDetails, isLoading: loadingOrder } = useQuery({
    queryKey: ['order_details', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, payment_method, payment_status, source, total, created_at, shipping_address, user_id')
        .eq('id', selectedOrderId)
        .maybeSingle();
      
      if (orderError) throw orderError;
      if (!order) return null;

      // Buscar nome do cliente
      let customerName: string | null = null;
      
      // Primeiro tenta do perfil se tiver user_id
      if (order.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', order.user_id)
          .maybeSingle();
        
        if (profile?.full_name) {
          customerName = profile.full_name;
        }
      }
      
      // Se não encontrou, tenta do shipping_address
      if (!customerName && order.shipping_address) {
        const addr = order.shipping_address as { name?: string };
        customerName = addr.name || null;
      }

      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('id, product_name, product_image, quantity, unit_price, total_price')
        .eq('order_id', selectedOrderId);
      
      if (itemsError) throw itemsError;

      return {
        id: order.id,
        order_number: order.order_number,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        source: order.source,
        total: order.total,
        created_at: order.created_at,
        customer_name: customerName,
        order_items: items || []
      } as OrderDetails;
    },
    enabled: !!selectedOrderId
  });

  // Buscar contas a receber
  const { data: receivables = [], isLoading: loadingReceivables } = useQuery({
    queryKey: ['accounts_receivable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select('*')
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data as AccountReceivable[];
    }
  });

  // Buscar contas a pagar
  const { data: payables = [], isLoading: loadingPayables } = useQuery({
    queryKey: ['accounts_payable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_payable')
        .select('*')
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data as AccountPayable[];
    }
  });

  // Mutation para criar conta a pagar
  const createPayableMutation = useMutation({
    mutationFn: async (data: typeof newPayable) => {
      const { error } = await supabase.from('accounts_payable').insert({
        description: data.description,
        amount: parseFloat(data.amount),
        due_date: data.due_date,
        supplier_name: data.supplier_name || null,
        category: data.category || null,
        notes: data.notes || null,
        status: 'pending'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts_payable'] });
      setIsPayableDialogOpen(false);
      setNewPayable({ description: '', amount: '', due_date: '', supplier_name: '', category: '', notes: '' });
      toast.success('Conta a pagar criada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao criar conta a pagar');
    }
  });

  // Mutation para marcar como pago
  const markAsPaidMutation = useMutation({
    mutationFn: async ({ table, id }: { table: 'accounts_receivable' | 'accounts_payable', id: string }) => {
      const { error } = await supabase
        .from(table)
        .update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.table] });
      toast.success('Marcado como pago!');
    }
  });

  const getStatusBadge = (status: string, dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const isOverdue = due < today && status !== 'paid';

    if (status === 'paid') {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Pago</Badge>;
    }
    if (isOverdue) {
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Vencido</Badge>;
    }
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Calcular totais
  const totalReceivable = receivables.filter(r => r.status !== 'paid').reduce((acc, r) => acc + Number(r.amount), 0);
  const totalPayable = payables.filter(p => p.status !== 'paid').reduce((acc, p) => acc + Number(p.amount), 0);
  const totalReceived = receivables.filter(r => r.status === 'paid').reduce((acc, r) => acc + Number(r.amount), 0);
  const totalPaid = payables.filter(p => p.status === 'paid').reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Financeiro</h1>
        <p className="text-muted-foreground">Gerencie suas contas a receber e a pagar</p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{formatCurrency(totalReceivable)}</div>
            <p className="text-xs text-muted-foreground">Pendente de recebimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{formatCurrency(totalPayable)}</div>
            <p className="text-xs text-muted-foreground">Pendente de pagamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recebido</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalReceived)}</div>
            <p className="text-xs text-muted-foreground">Total já recebido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(totalReceivable - totalPayable) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(totalReceivable - totalPayable)}
            </div>
            <p className="text-xs text-muted-foreground">Previsão de caixa</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Contas */}
      <Tabs defaultValue="receivables" className="space-y-4">
        <TabsList>
          <TabsTrigger value="receivables" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Contas a Receber ({receivables.length})
          </TabsTrigger>
          <TabsTrigger value="payables" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            Contas a Pagar ({payables.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receivables">
          <Card>
            <CardHeader>
              <CardTitle>Contas a Receber</CardTitle>
              <p className="text-sm text-muted-foreground">
                Vendas do site e PDV aparecem automaticamente aqui
              </p>
            </CardHeader>
            <CardContent>
              {loadingReceivables ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : receivables.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhuma conta a receber</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivables.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{item.customer_name || '-'}</TableCell>
                        <TableCell className="text-green-500 font-semibold">
                          {formatCurrency(Number(item.amount))}
                        </TableCell>
                        <TableCell>
                          {format(new Date(item.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status, item.due_date)}</TableCell>
                        <TableCell className="space-x-2">
                          {item.order_id && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setSelectedOrderId(item.order_id);
                                setIsDetailsOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Detalhes
                            </Button>
                          )}
                          {item.status !== 'paid' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => markAsPaidMutation.mutate({ table: 'accounts_receivable', id: item.id })}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Recebido
                            </Button>
                          )}
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
              <div>
                <CardTitle>Contas a Pagar</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Gerencie suas despesas e pagamentos
                </p>
              </div>
              <Dialog open={isPayableDialogOpen} onOpenChange={setIsPayableDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Conta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Conta a Pagar</DialogTitle>
                  </DialogHeader>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      createPayableMutation.mutate(newPayable);
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <Label htmlFor="description">Descrição *</Label>
                      <Input
                        id="description"
                        value={newPayable.description}
                        onChange={(e) => setNewPayable(p => ({ ...p, description: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="amount">Valor *</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={newPayable.amount}
                          onChange={(e) => setNewPayable(p => ({ ...p, amount: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="due_date">Vencimento *</Label>
                        <Input
                          id="due_date"
                          type="date"
                          value={newPayable.due_date}
                          onChange={(e) => setNewPayable(p => ({ ...p, due_date: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="supplier_name">Fornecedor</Label>
                      <Input
                        id="supplier_name"
                        value={newPayable.supplier_name}
                        onChange={(e) => setNewPayable(p => ({ ...p, supplier_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Categoria</Label>
                      <Select
                        value={newPayable.category}
                        onValueChange={(value) => setNewPayable(p => ({ ...p, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
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
                    <div>
                      <Label htmlFor="notes">Observações</Label>
                      <Textarea
                        id="notes"
                        value={newPayable.notes}
                        onChange={(e) => setNewPayable(p => ({ ...p, notes: e.target.value }))}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={createPayableMutation.isPending}>
                      {createPayableMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingPayables ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : payables.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhuma conta a pagar</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payables.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{item.supplier_name || '-'}</TableCell>
                        <TableCell>{item.category || '-'}</TableCell>
                        <TableCell className="text-red-500 font-semibold">
                          {formatCurrency(Number(item.amount))}
                        </TableCell>
                        <TableCell>
                          {format(new Date(item.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status, item.due_date)}</TableCell>
                        <TableCell>
                          {item.status !== 'paid' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => markAsPaidMutation.mutate({ table: 'accounts_payable', id: item.id })}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Pago
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Detalhes do Pedido */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Detalhes da Venda
            </DialogTitle>
          </DialogHeader>
          
          {loadingOrder ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : orderDetails ? (
            <div className="space-y-6">
              {/* Info do Pedido */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Pedido</p>
                  <p className="font-semibold">{orderDetails.order_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-semibold">{orderDetails.customer_name || 'Cliente PDV'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-semibold">
                    {format(new Date(orderDetails.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Origem</p>
                  <div className="flex items-center gap-2">
                    {orderDetails.source === 'pdv' ? (
                      <>
                        <Store className="h-4 w-4 text-orange-500" />
                        <Badge variant="outline" className="border-orange-500 text-orange-500">Loja Física (PDV)</Badge>
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4 text-blue-500" />
                        <Badge variant="outline" className="border-blue-500 text-blue-500">Site</Badge>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Forma de Pagamento</p>
                  <div className="flex items-center gap-2">
                    {orderDetails.payment_method === 'dinheiro' ? (
                      <>
                        <Banknote className="h-4 w-4 text-green-500" />
                        <span className="font-semibold">Dinheiro</span>
                      </>
                    ) : orderDetails.payment_method === 'pix' ? (
                      <>
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="font-semibold">PIX</span>
                      </>
                    ) : orderDetails.payment_method === 'cartao_credito' ? (
                      <>
                        <CreditCard className="h-4 w-4 text-purple-500" />
                        <span className="font-semibold">Cartão de Crédito</span>
                      </>
                    ) : orderDetails.payment_method === 'cartao_debito' ? (
                      <>
                        <CreditCard className="h-4 w-4 text-blue-500" />
                        <span className="font-semibold">Cartão de Débito</span>
                      </>
                    ) : (
                      <span className="font-semibold">{orderDetails.payment_method || 'Não informado'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Produtos */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Produtos ({orderDetails.order_items.length})
                </h4>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {orderDetails.order_items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="w-16 h-16 bg-background rounded-lg overflow-hidden flex-shrink-0">
                        {item.product_image ? (
                          <img 
                            src={item.product_image} 
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Package className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity}x {formatCurrency(Number(item.unit_price))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          {formatCurrency(Number(item.total_price))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(Number(orderDetails.total))}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              Detalhes do pedido não encontrados
            </p>
          )}
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
