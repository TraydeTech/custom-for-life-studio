import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MessageCircle, Search, ArrowLeft, Send, Clock, CheckCircle, AlertCircle, User
} from 'lucide-react';

interface Ticket {
  id: string;
  numero_ticket: string;
  tipo: string;
  descricao: string | null;
  status: string;
  usuario_email: string | null;
  usuario_id: string | null;
  created_at: string | null;
  resolvido_em: string | null;
  resposta: string | null;
  customer_name?: string | null;
}

interface Mensagem {
  id: string;
  ticket_id: string;
  mensagem: string;
  remetente: string;
  lida: boolean | null;
  created_at: string | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  aberto: { label: 'Aberto', variant: 'destructive', icon: AlertCircle },
  em_andamento: { label: 'Em andamento', variant: 'default', icon: Clock },
  resolvido: { label: 'Resolvido', variant: 'secondary', icon: CheckCircle },
  fechado: { label: 'Fechado', variant: 'outline', icon: CheckCircle },
};

export default function AdminChamados() {
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: async () => {
      const { data: ticketsData, error } = await supabase
        .from('tickets_suporte')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch customer names for tickets with usuario_id
      const userIds = [...new Set((ticketsData || []).map(t => t.usuario_id).filter(Boolean))];
      let profilesMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds as string[]);

        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name || '']));
        }
      }

      return (ticketsData || []).map(t => ({
        ...t,
        customer_name: t.usuario_id ? profilesMap[t.usuario_id] || null : null,
      })) as Ticket[];
    },
  });

  const loadMessages = async (ticketId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('suporte_mensagens')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMensagens(data as Mensagem[]);
      // Mark client messages as read
      const unread = data.filter(m => m.remetente !== 'suporte' && !m.lida);
      if (unread.length > 0) {
        await supabase
          .from('suporte_mensagens')
          .update({ lida: true })
          .in('id', unread.map(m => m.id));
      }
    }
    setLoadingMessages(false);
  };

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    loadMessages(ticket.id);
  };

  // Realtime for messages
  useEffect(() => {
    if (!selectedTicket) return;

    const channel = supabase
      .channel(`admin-ticket-${selectedTicket.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'suporte_mensagens',
        filter: `ticket_id=eq.${selectedTicket.id}`,
      }, (payload) => {
        const newMsg = payload.new as Mensagem;
        setMensagens(prev => [...prev, newMsg]);
        if (newMsg.remetente !== 'suporte') {
          supabase.from('suporte_mensagens').update({ lida: true }).eq('id', newMsg.id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const handleSendMessage = async () => {
    if (!novaMensagem.trim() || !selectedTicket) return;
    setSending(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada. Faça login novamente.');
      const res = await fetch(`${supabaseUrl}/functions/v1/support-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: 'send_message',
          ticket_number: selectedTicket.numero_ticket,
          message: novaMensagem.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setNovaMensagem('');
      // Update ticket status to em_andamento if it was aberto
      if (selectedTicket.status === 'aberto') {
        await supabase.from('tickets_suporte').update({ status: 'em_andamento' }).eq('id', selectedTicket.id);
        setSelectedTicket(prev => prev ? { ...prev, status: 'em_andamento' } : null);
        queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
        queryClient.invalidateQueries({ queryKey: ['open-tickets-count'] });
      }
    } catch (err) {
      toast({ title: 'Erro ao enviar', description: (err as Error).message, variant: 'destructive' });
    }
    setSending(false);
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!selectedTicket) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada. Faça login novamente.');
      const res = await fetch(`${supabaseUrl}/functions/v1/support-ticket`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          ticket_number: selectedTicket.numero_ticket,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['open-tickets-count'] });
      toast({ title: 'Status atualizado' });
    } catch (err) {
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getStatus = (s: string) => statusConfig[s] || statusConfig.aberto;

  const filtered = tickets.filter(t => {
    if (statusFilter !== 'todos' && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.numero_ticket.toLowerCase().includes(q) ||
        (t.usuario_email || '').toLowerCase().includes(q) ||
        (t.customer_name || '').toLowerCase().includes(q) ||
        (t.descricao || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Chamados</h1>
              <p className="text-muted-foreground mt-1">Gerencie os tickets de suporte dos clientes</p>
            </div>
          </div>

          {selectedTicket ? (
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {selectedTicket.numero_ticket}
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{selectedTicket.customer_name || selectedTicket.usuario_email || 'Anônimo'}</span>
                    <span>•</span>
                    <span>{selectedTicket.tipo}</span>
                    <span>•</span>
                    <span>{formatDate(selectedTicket.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedTicket.status} onValueChange={handleChangeStatus}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="em_andamento">Em andamento</SelectItem>
                      <SelectItem value="resolvido">Resolvido</SelectItem>
                      <SelectItem value="fechado">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {selectedTicket.descricao && (
                  <div className="mb-4 p-3 bg-muted rounded-lg text-sm">
                    <p className="font-medium mb-1">Descrição do chamado:</p>
                    <p>{selectedTicket.descricao}</p>
                  </div>
                )}

                <div className="border rounded-lg h-[400px] flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingMessages ? (
                      <div className="space-y-3">
                        <Skeleton className="h-12 w-3/4" />
                        <Skeleton className="h-12 w-2/3 ml-auto" />
                      </div>
                    ) : mensagens.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Nenhuma mensagem ainda</p>
                    ) : (
                      mensagens.map(m => (
                        <div key={m.id} className={`flex ${m.remetente === 'suporte' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            m.remetente === 'suporte'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}>
                            <p className="text-sm">{m.mensagem}</p>
                            <p className={`text-xs mt-1 ${
                              m.remetente === 'suporte' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}>
                              {m.remetente === 'suporte' ? 'Suporte' : 'Cliente'} • {formatDate(m.created_at)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {selectedTicket.status !== 'resolvido' && selectedTicket.status !== 'fechado' && (
                    <div className="border-t p-3 flex gap-2">
                      <Textarea
                        placeholder="Digite sua resposta..."
                        value={novaMensagem}
                        onChange={e => setNovaMensagem(e.target.value)}
                        className="min-h-[40px] max-h-[100px] resize-none"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      />
                      <Button onClick={handleSendMessage} disabled={sending || !novaMensagem.trim()} size="icon">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por ticket, email ou nome..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="em_andamento">Em andamento</SelectItem>
                      <SelectItem value="resolvido">Resolvido</SelectItem>
                      <SelectItem value="fechado">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum chamado encontrado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(ticket => {
                        const st = getStatus(ticket.status);
                        const StIcon = st.icon;
                        return (
                          <TableRow
                            key={ticket.id}
                            className="cursor-pointer"
                            onClick={() => handleSelectTicket(ticket)}
                          >
                            <TableCell className="font-medium">{ticket.numero_ticket}</TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{ticket.customer_name || '-'}</p>
                                <p className="text-xs text-muted-foreground">{ticket.usuario_email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">{ticket.tipo}</TableCell>
                            <TableCell>
                              <Badge variant={st.variant} className="gap-1">
                                <StIcon className="h-3 w-3" />
                                {st.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(ticket.created_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
