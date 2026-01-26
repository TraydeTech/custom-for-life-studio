import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, CheckCircle, Clock, AlertTriangle, XCircle, Plus, TrendingDown, Calendar } from 'lucide-react';
import { toast } from 'sonner';

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

const categories = [
  'Fornecedor',
  'Aluguel',
  'Energia',
  'Internet/Telefone',
  'Funcionários',
  'Impostos',
  'Marketing',
  'Outros',
];

function ContasPagarContent() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    description: '',
    amount: '',
    due_date: '',
    supplier_name: '',
    category: '',
    notes: '',
  });
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts-payable', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('accounts_payable')
        .select('*')
        .order('due_date', { ascending: true });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AccountPayable[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (account: typeof newAccount) => {
      const { error } = await supabase
        .from('accounts_payable')
        .insert({
          description: account.description,
          amount: parseFloat(account.amount),
          due_date: account.due_date,
          supplier_name: account.supplier_name || null,
          category: account.category || null,
          notes: account.notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      toast.success('Conta criada com sucesso!');
      setIsDialogOpen(false);
      setNewAccount({
        description: '',
        amount: '',
        due_date: '',
        supplier_name: '',
        category: '',
        notes: '',
      });
    },
    onError: () => {
      toast.error('Erro ao criar conta');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, paid_date }: { id: string; status: string; paid_date?: string }) => {
      const { error } = await supabase
        .from('accounts_payable')
        .update({ status, paid_date: paid_date || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  const handleMarkAsPaid = (id: string) => {
    updateStatusMutation.mutate({ 
      id, 
      status: 'paid', 
      paid_date: new Date().toISOString().split('T')[0] 
    });
  };

  const handleMarkAsCancelled = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'cancelled' });
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.description || !newAccount.amount || !newAccount.due_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    createMutation.mutate(newAccount);
  };

  const filteredAccounts = accounts?.filter(account =>
    account.description.toLowerCase().includes(search.toLowerCase()) ||
    account.supplier_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status === 'pending';
    
    if (isOverdue) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Vencido</Badge>;
    }
    
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500 gap-1"><CheckCircle className="h-3 w-3" /> Pago</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Cancelado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Calcular totais
  const totalPending = filteredAccounts?.filter(a => a.status === 'pending').reduce((sum, a) => sum + Number(a.amount), 0) || 0;
  const totalPaid = filteredAccounts?.filter(a => a.status === 'paid').reduce((sum, a) => sum + Number(a.amount), 0) || 0;
  const totalOverdue = filteredAccounts?.filter(a => a.status === 'pending' && new Date(a.due_date) < new Date()).reduce((sum, a) => sum + Number(a.amount), 0) || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contas a Pagar</h1>
            <p className="text-muted-foreground">Gerencie suas despesas e pagamentos</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Conta a Pagar</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <Input
                    id="description"
                    value={newAccount.description}
                    onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                    placeholder="Ex: Conta de energia"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={newAccount.amount}
                      onChange={(e) => setNewAccount({ ...newAccount, amount: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Vencimento *</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={newAccount.due_date}
                      onChange={(e) => setNewAccount({ ...newAccount, due_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Fornecedor</Label>
                    <Input
                      id="supplier"
                      value={newAccount.supplier_name}
                      onChange={(e) => setNewAccount({ ...newAccount, supplier_name: e.target.value })}
                      placeholder="Nome do fornecedor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                      value={newAccount.category}
                      onValueChange={(value) => setNewAccount({ ...newAccount, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={newAccount.notes}
                    onChange={(e) => setNewAccount({ ...newAccount, notes: e.target.value })}
                    placeholder="Observações adicionais..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalPending)}</div>
              <p className="text-xs text-muted-foreground">Pagamentos pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pago</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
              <p className="text-xs text-muted-foreground">Total já pago</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencido</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</div>
              <p className="text-xs text-muted-foreground">Em atraso</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredAccounts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma conta encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts?.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{account.description}</p>
                          {account.notes && (
                            <p className="text-sm text-muted-foreground">{account.notes}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{account.supplier_name || '-'}</TableCell>
                      <TableCell>
                        {account.category && (
                          <Badge variant="outline">{account.category}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(account.amount)}</TableCell>
                      <TableCell>{formatDate(account.due_date)}</TableCell>
                      <TableCell>{getStatusBadge(account.status, account.due_date)}</TableCell>
                      <TableCell className="text-right">
                        {account.status === 'pending' && (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleMarkAsPaid(account.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Pago
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleMarkAsCancelled(account.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {account.status === 'paid' && account.paid_date && (
                          <span className="text-sm text-muted-foreground">
                            Pago em {formatDate(account.paid_date)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

export default function ContasPagar() {
  return (
    <ProtectedAdminRoute>
      <ContasPagarContent />
    </ProtectedAdminRoute>
  );
}
