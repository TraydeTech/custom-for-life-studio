import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/dialog';
import { Search, User, Eye, ShoppingBag, MapPin, Phone, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'> & { email?: string | null };
type Address = Tables<'addresses'>;
type Order = Tables<'orders'>;

interface CustomerWithDetails extends Profile {
  addresses: Address[];
  orders: Order[];
  totalSpent: number;
}

export default function AdminClientes() {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async () => {
      // Buscar IDs dos admins para excluí-los da lista de clientes
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      
      const adminIds = adminRoles?.map(r => r.user_id) || [];

      // Buscar todos os profiles exceto admins
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Filtrar para remover admins
      const customerProfiles = (profiles || []).filter(p => !adminIds.includes(p.user_id));

      // Para cada profile de cliente, buscar endereços e pedidos
      const customersWithDetails: CustomerWithDetails[] = await Promise.all(
        customerProfiles.map(async (profile) => {
          const [addressesResult, ordersResult] = await Promise.all([
            supabase.from('addresses').select('*').eq('user_id', profile.user_id),
            supabase.from('orders').select('*').eq('user_id', profile.user_id).order('created_at', { ascending: false }),
          ]);

          const orders = ordersResult.data || [];
          const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0);

          return {
            ...profile,
            addresses: addressesResult.data || [],
            orders,
            totalSpent,
          };
        })
      );

      return customersWithDetails;
    },
  });

  const handleViewDetails = (customer: CustomerWithDetails) => {
    setSelectedCustomer(customer);
    setIsDetailsOpen(true);
  };

  const filteredCustomers = customers?.filter((c) =>
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.cpf?.includes(search)
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return '-';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-500',
    paid: 'bg-blue-500/20 text-blue-500',
    processing: 'bg-purple-500/20 text-purple-500',
    shipped: 'bg-cyan-500/20 text-cyan-500',
    delivered: 'bg-green-500/20 text-green-500',
    cancelled: 'bg-red-500/20 text-red-500',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    paid: 'Pago',
    processing: 'Processando',
    shipped: 'Enviado',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-heading font-bold">Clientes</h1>
            <p className="text-muted-foreground">Veja todos os clientes cadastrados e seu histórico</p>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Total Gasto</TableHead>
                  <TableHead>Cadastro</TableHead>
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
                ) : filteredCustomers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers?.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          {customer.full_name || 'Sem nome'}
                        </div>
                      </TableCell>
                      <TableCell>{formatPhone(customer.phone)}</TableCell>
                      <TableCell>{formatCPF(customer.cpf)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{customer.orders.length}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-green-500">
                        {formatCurrency(customer.totalSpent)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(customer.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(customer)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {selectedCustomer?.full_name || 'Cliente'}
                </DialogTitle>
              </DialogHeader>

              {selectedCustomer && (
                <div className="space-y-6">
                  {/* Informações do Cliente */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="font-medium">{formatPhone(selectedCustomer.phone)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium">{selectedCustomer.email || '-'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">CPF</p>
                        <p className="font-medium">{formatCPF(selectedCustomer.cpf)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Total Gasto</p>
                        <p className="font-medium text-green-500">{formatCurrency(selectedCustomer.totalSpent)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Endereços */}
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <MapPin className="h-5 w-5" />
                      Endereços Cadastrados
                    </h3>
                    {selectedCustomer.addresses.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhum endereço cadastrado</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedCustomer.addresses.map((address) => (
                          <div key={address.id} className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{address.label || 'Endereço'}</span>
                              {address.is_default && (
                                <Badge variant="secondary" className="text-xs">Padrão</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {address.street}, {address.number}
                              {address.complement && ` - ${address.complement}`}, {address.neighborhood}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {address.city} - {address.state}, CEP: {address.zip_code}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Histórico de Pedidos */}
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <ShoppingBag className="h-5 w-5" />
                      Histórico de Compras ({selectedCustomer.orders.length})
                    </h3>
                    {selectedCustomer.orders.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhum pedido realizado</p>
                    ) : (
                      <div className="border rounded-lg divide-y">
                        {selectedCustomer.orders.map((order) => (
                          <div key={order.id} className="flex items-center justify-between p-3">
                            <div>
                              <p className="font-medium">{order.order_number}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <Badge className={statusColors[order.status]}>
                                {statusLabels[order.status]}
                              </Badge>
                              <p className="font-medium">{formatCurrency(order.total)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
