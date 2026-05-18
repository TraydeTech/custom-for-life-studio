import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Search, ChevronRight, Clock, Package, Truck, CheckCircle,
  CreditCard, QrCode, Banknote, Eye, ArrowRight, Image as ImageIcon, Download, FileImage
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

const PDV_STATUSES = [
  { id: 'aguardando_pagamento', label: 'Aguardando Pagamento', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
  { id: 'em_producao', label: 'Pago — Em Produção', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Package },
  { id: 'gravando', label: 'Gravando', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Package },
  { id: 'pronto_envio', label: 'Pronto para Envio', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: Package },
  { id: 'enviado', label: 'Enviado', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Truck },
  { id: 'entregue', label: 'Entregue', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
];

type OrderWithItems = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  pdv_status: string | null;
  total: number;
  created_at: string;
  tracking_code: string | null;
  notes: string | null;
  shipping_address: any;
  user_id: string | null;
  customer_name?: string;
  items?: any[];
};

function GestaoPedidosContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [engravingZoomItem, setEngravingZoomItem] = useState<any>(null);
  const [zoomedImageType, setZoomedImageType] = useState<'preview' | 'original'>('preview');

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    }
  };

  // Fetch orders with realtime
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['kanban-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status, payment_method, total, created_at, tracking_code, notes, shipping_address, user_id')
        .eq('source', 'site')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rawOrders = (data || []) as any[];

      // Get customer names
      const userIds = rawOrders.map((o: any) => o.user_id).filter(Boolean);
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: p } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds as string[]);
        profiles = p || [];
      }

      return rawOrders.map((order: any) => {
        const profile = profiles.find((p: any) => p.user_id === order.user_id);
        let customerName = profile?.full_name;
        if (!customerName && order.notes) {
          const match = order.notes.match(/Cliente:\s*([^|]+)/i);
          if (match) customerName = match[1].trim();
        }
        // Read pdv_status from the raw data (column added via migration, not yet in types)
        return { ...order, pdv_status: (order as any).pdv_status || 'aguardando_pagamento', customer_name: customerName || 'Cliente' } as OrderWithItems;
      });
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('kanban-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['kanban-orders'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Update pdv_status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus, trackingCode: tc }: { orderId: string; newStatus: string; trackingCode?: string }) => {
      const updates: any = { pdv_status: newStatus };
      if (newStatus === 'enviado' && tc) {
        updates.tracking_code = tc;
        updates.sent_at = new Date().toISOString();
        updates.status = 'shipped';
        updates.shipped_at = new Date().toISOString();
      }
      if (newStatus === 'entregue') {
        updates.status = 'delivered';
        updates.delivered_at = new Date().toISOString();
      }
      const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Status atualizado!');
      setIsDetailOpen(false);
    },
  });

  // Load order items when detail opens
  const { data: orderItems = [] } = useQuery({
    queryKey: ['order-items', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return [];
      const { data } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', selectedOrder.id);
      return data || [];
    },
    enabled: !!selectedOrder,
  });

  const getDateRange = () => {
    const now = new Date();
    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return start;
    }
    if (dateFilter === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start;
    }
    if (dateFilter === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start;
    }
    return null;
  };

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(o =>
        o.order_number.toLowerCase().includes(s) ||
        o.customer_name?.toLowerCase().includes(s)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(o => (o.pdv_status || 'aguardando_pagamento') === statusFilter);
    }
    const dateRange = getDateRange();
    if (dateRange) {
      result = result.filter(o => new Date(o.created_at) >= dateRange);
    }
    return result;
  }, [orders, search, statusFilter, dateFilter]);

  const getPaymentIcon = (method: string | null) => {
    if (method === 'pix') return <QrCode className="h-4 w-4 text-primary" />;
    if (method === 'credito') return <CreditCard className="h-4 w-4 text-purple-400" />;
    if (method === 'debito') return <CreditCard className="h-4 w-4 text-blue-400" />;
    if (method === 'dinheiro') return <Banknote className="h-4 w-4 text-green-400" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const ordersByStatus = useMemo(() => {
    const grouped: Record<string, OrderWithItems[]> = {};
    PDV_STATUSES.forEach(s => { grouped[s.id] = []; });
    filteredOrders.forEach(order => {
      const status = order.pdv_status || 'aguardando_pagamento';
      if (grouped[status]) grouped[status].push(order);
    });
    return grouped;
  }, [filteredOrders]);

  const handleMoveToNext = (order: OrderWithItems) => {
    const currentIdx = PDV_STATUSES.findIndex(s => s.id === (order.pdv_status || 'aguardando_pagamento'));
    if (currentIdx < PDV_STATUSES.length - 1) {
      const nextStatus = PDV_STATUSES[currentIdx + 1].id;
      if (nextStatus === 'enviado') {
        setSelectedOrder(order);
        setIsDetailOpen(true);
      } else {
        updateStatusMutation.mutate({ orderId: order.id, newStatus: nextStatus });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-heading font-bold">Gestão de Pedidos</h1>
        <p className="text-muted-foreground">Acompanhe o fluxo completo dos pedidos do site</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por pedido ou cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {PDV_STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando pedidos...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
          {PDV_STATUSES.map(statusDef => (
            <div key={statusDef.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className={statusDef.color}>{statusDef.label}</Badge>
                <Badge variant="secondary" className="text-xs">{ordersByStatus[statusDef.id]?.length || 0}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {(ordersByStatus[statusDef.id] || []).map(order => (
                  <Card key={order.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setSelectedOrder(order); setIsDetailOpen(true); }}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold">{order.order_number}</span>
                        {getPaymentIcon(order.payment_method)}
                      </div>
                      <p className="text-sm font-medium truncate">{order.customer_name}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), 'dd/MM HH:mm')}
                        </span>
                        <span className="font-bold text-sm text-primary">{formatCurrency(Number(order.total))}</span>
                      </div>
                      {statusDef.id !== 'entregue' && (
                        <Button size="sm" variant="ghost" className="w-full gap-1 text-xs h-7" onClick={e => { e.stopPropagation(); handleMoveToNext(order); }}>
                          Avançar <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> <strong>{selectedOrder.customer_name}</strong></div>
                <div><span className="text-muted-foreground">Data:</span> <strong>{format(new Date(selectedOrder.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></div>
                <div><span className="text-muted-foreground">Pagamento:</span> <strong className="capitalize">{selectedOrder.payment_method || 'Pendente'}</strong></div>
                <div><span className="text-muted-foreground">Total:</span> <strong className="text-primary">{formatCurrency(Number(selectedOrder.total))}</strong></div>
              </div>

              <Separator />

              {/* Items with engraving */}
              <div className="space-y-3">
                <h4 className="font-semibold">Itens do Pedido</h4>
                {orderItems.map((item: any) => (
                  <div key={item.id} className="flex gap-4 p-3 bg-muted/50 rounded-lg items-start">
                    <div className="flex gap-2 shrink-0">
                      {/* Produto/Prévia */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-16 h-16 bg-white rounded border overflow-hidden">
                          {item.engraving_preview_url || item.product_image ? (
                            <img 
                              src={item.engraving_preview_url || item.product_image || ''} 
                              className="w-full h-full object-contain cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                setEngravingZoomItem(item);
                                setZoomedImageType('preview');
                              }}
                              title="Ver Prévia"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted"><Package className="h-6 w-6 text-muted-foreground" /></div>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground uppercase font-semibold">Produto</span>
                      </div>

                      {/* Arquivo do Cliente */}
                      {item.engraving_file_url && (
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-16 h-16 bg-white rounded border overflow-hidden relative group">
                            <img 
                              src={item.engraving_file_url} 
                              className="w-full h-full object-contain cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                setEngravingZoomItem(item);
                                setZoomedImageType('original');
                              }}
                              title="Ver Arquivo Original"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                              <Eye className="h-4 w-4 text-white" />
                            </div>
                          </div>
                          <span className="text-[9px] text-muted-foreground uppercase font-semibold">Arquivo</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 pt-1">
                      <p className="font-medium text-sm">{item.product_name}{item.product_color && ` — ${item.product_color}`}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.quantity}x {formatCurrency(Number(item.unit_price))} = {formatCurrency(Number(item.total_price))}
                      </p>
                      {item.engraving_text && (
                        <p className="text-xs text-primary font-medium mt-1">Texto: "{item.engraving_text}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Status Change */}
              <div className="space-y-3">
                <h4 className="font-semibold">Atualizar Status</h4>
                {(selectedOrder.pdv_status || 'aguardando_pagamento') === 'gravando' && (
                  <Button className="w-full" onClick={() => updateStatusMutation.mutate({ orderId: selectedOrder.id, newStatus: 'pronto_envio' })}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Gravação Concluída ✓
                  </Button>
                )}
                {((selectedOrder.pdv_status || 'aguardando_pagamento') === 'pronto_envio' || (selectedOrder.pdv_status || 'aguardando_pagamento') === 'enviado') && (
                  <div className="space-y-2">
                    <Label>Código de Rastreamento</Label>
                    <Input value={trackingCode} onChange={e => setTrackingCode(e.target.value)} placeholder="Código de rastreamento..." />
                    <Button className="w-full" onClick={() => updateStatusMutation.mutate({ orderId: selectedOrder.id, newStatus: 'enviado', trackingCode })} disabled={!trackingCode}>
                      <Truck className="h-4 w-4 mr-2" /> Marcar como Enviado
                    </Button>
                  </div>
                )}
                <Select value={selectedOrder.pdv_status || 'aguardando_pagamento'} onValueChange={newStatus => updateStatusMutation.mutate({ orderId: selectedOrder.id, newStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PDV_STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Engraving Zoom */}
      <Dialog open={!!engravingZoomItem} onOpenChange={() => setEngravingZoomItem(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white border-none shadow-2xl [&>button]:text-slate-900 [&>button]:opacity-100 [&>button:hover]:bg-slate-100">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-lg font-mono">
              {selectedOrder?.order_number || 'Visualização'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-0 bg-white">
            <div className="flex items-center justify-center bg-white min-h-[40vh] relative group">
              {engravingZoomItem && (
                <img 
                  src={zoomedImageType === 'preview' 
                    ? (engravingZoomItem.engraving_preview_url || engravingZoomItem.product_image || '') 
                    : (engravingZoomItem.engraving_file_url || '')} 
                  alt="Zoom" 
                  className="max-w-full max-h-[70vh] object-contain transition-transform duration-300" 
                />
              )}
            </div>
            
            <div className="p-6 bg-slate-50 border-t space-y-4">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">{engravingZoomItem?.product_name}</p>
                </div>
                
                <div className="flex gap-2">
                  {engravingZoomItem?.engraving_file_url && (
                    <Button 
                      size="sm"
                      variant={zoomedImageType === 'original' ? 'default' : 'outline'}
                      onClick={() => setZoomedImageType(zoomedImageType === 'preview' ? 'original' : 'preview')}
                      className={`gap-2 font-semibold ${zoomedImageType === 'preview' ? 'border-primary text-primary hover:bg-primary hover:text-white' : ''}`}
                    >
                      <FileImage className="h-4 w-4" />
                      {zoomedImageType === 'preview' ? 'Ver Arquivo Original' : 'Voltar para Prévia'}
                    </Button>
                  )}
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-2 bg-white border-primary text-primary hover:bg-primary hover:text-white transition-all font-semibold"
                    onClick={() => {
                      const url = zoomedImageType === 'preview' 
                        ? (engravingZoomItem?.engraving_preview_url || engravingZoomItem?.product_image) 
                        : engravingZoomItem?.engraving_file_url;
                      if (url) handleDownload(url, `arquivo-${engravingZoomItem?.id?.substring(0, 8) || 'item'}-${zoomedImageType}.png`);
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Download {zoomedImageType === 'preview' ? 'Prévia' : 'Arquivo'}
                  </Button>
                </div>
              </div>

              {engravingZoomItem?.engraving_text && (
                <div className="p-4 bg-white rounded-xl border-2 border-primary/10 shadow-sm">
                  <p className="text-[10px] text-primary uppercase font-black tracking-widest mb-1">Texto para Gravação</p>
                  <p className="text-2xl font-black text-slate-900 leading-tight">"{engravingZoomItem.engraving_text}"</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GestaoPedidos() {
  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <GestaoPedidosContent />
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
