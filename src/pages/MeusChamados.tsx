import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountLayout } from '@/components/account/AccountLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, MessageCircle, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Ticket {
  id: string;
  numero_ticket: string;
  tipo: string;
  descricao: string | null;
  status: string;
  created_at: string | null;
  resolvido_em: string | null;
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
};

export default function MeusChamados() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user, navigate]);

  // Fetch tickets and unread counts
  useEffect(() => {
    if (!user) return;
    const fetchTickets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets_suporte')
        .select('*')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTickets(data);
        // Fetch unread message counts for each ticket
        const ticketIds = data.map(t => t.id);
        if (ticketIds.length > 0) {
          const { data: unreadMsgs } = await supabase
            .from('suporte_mensagens')
            .select('ticket_id')
            .in('ticket_id', ticketIds)
            .eq('lida', false)
            .neq('remetente', 'cliente');
          
          if (unreadMsgs) {
            const counts: Record<string, number> = {};
            unreadMsgs.forEach(m => {
              counts[m.ticket_id] = (counts[m.ticket_id] || 0) + 1;
            });
            setUnreadCounts(counts);
          }
        }
      }
      setLoading(false);
    };
    fetchTickets();
  }, [user]);

  // Fetch messages for selected ticket
  useEffect(() => {
    if (!selectedTicket) return;
    const fetchMsgs = async () => {
      setLoadingMsgs(true);
      const { data, error } = await supabase
        .from('suporte_mensagens')
        .select('*')
        .eq('ticket_id', selectedTicket.id)
        .order('created_at', { ascending: true });

      if (!error && data) setMensagens(data);
      setLoadingMsgs(false);

      // Mark unread messages as read
      await supabase
        .from('suporte_mensagens')
        .update({ lida: true })
        .eq('ticket_id', selectedTicket.id)
        .eq('lida', false)
        .neq('remetente', 'cliente');
    };
    fetchMsgs();
  }, [selectedTicket]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedTicket) return;

    const channel = supabase
      .channel(`msgs-${selectedTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'suporte_mensagens',
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Mensagem;
          setMensagens((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Auto mark as read
          if (newMsg.remetente !== 'cliente') {
            supabase
              .from('suporte_mensagens')
              .update({ lida: true })
              .eq('id', newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket || !user) return;
    setSending(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/support-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          ticket_number: selectedTicket.numero_ticket,
          sender_name: 'cliente',
          message: newMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setNewMessage('');
    } catch (e: any) {
      toast({ title: 'Erro ao enviar mensagem', description: e.message, variant: 'destructive' });
    }

    setSending(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getStatus = (status: string) => statusConfig[status] || statusConfig.aberto;

  if (authLoading) {
    return (
      <AccountLayout title="Meus Chamados">
        <Skeleton className="h-40 w-full" />
      </AccountLayout>
    );
  }

  // Ticket detail view
  if (selectedTicket) {
    const st = getStatus(selectedTicket.status);
    return (
      <AccountLayout title="Meus Chamados">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>

          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{selectedTicket.numero_ticket}</span>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedTicket.tipo} • {formatDate(selectedTicket.created_at)}
              </p>
              {selectedTicket.descricao && (
                <p className="text-sm mt-2">{selectedTicket.descricao}</p>
              )}
            </CardContent>
          </Card>

          {/* Messages */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Mensagens</h3>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {loadingMsgs ? (
                  <Skeleton className="h-20 w-full" />
                ) : mensagens.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma mensagem ainda.
                  </p>
                ) : (
                  mensagens.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.remetente === 'cliente' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.remetente === 'cliente'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {msg.remetente === 'cliente' ? 'Você' : 'Suporte'}
                        </p>
                        <p>{msg.mensagem}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] opacity-50">
                            {formatDate(msg.created_at)}
                          </span>
                          {msg.remetente === 'cliente' && (
                            <span className={`text-[10px] ${msg.lida ? 'text-blue-400' : 'opacity-50'}`} title={msg.lida ? 'Lida pelo suporte' : 'Enviada'}>
                              {msg.lida ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Send message (only if not resolved) */}
              {selectedTicket.status !== 'resolvido' && (
                <div className="flex gap-2 mt-4">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="text-sm min-h-[60px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
                    size="icon"
                    className="shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AccountLayout>
    );
  }

  // Ticket list view
  return (
    <AccountLayout title="Meus Chamados">
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-semibold">Nenhum chamado encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Utilize o botão de suporte para abrir um chamado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const st = getStatus(ticket.status);
            const StatusIcon = st.icon;
            const unread = unreadCounts[ticket.id] || 0;
            return (
              <Card
                key={ticket.id}
                className={`cursor-pointer hover:border-primary/50 transition-colors ${unread > 0 ? 'border-primary/30 bg-primary/5' : ''}`}
                onClick={() => {
                  setSelectedTicket(ticket);
                  setUnreadCounts(prev => ({ ...prev, [ticket.id]: 0 }));
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon className="h-4 w-4" />
                      <span className="font-medium text-sm">{ticket.numero_ticket}</span>
                      {unread > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                          {unread} {unread === 1 ? 'nova' : 'novas'}
                        </Badge>
                      )}
                    </div>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ticket.tipo} • {formatDate(ticket.created_at)}
                  </p>
                  {ticket.descricao && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {ticket.descricao}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AccountLayout>
  );
}
