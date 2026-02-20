import { useState, useRef } from 'react';
import { MessageCircle, X, Send, Paperclip, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface SupportWidgetProps {
  clientSystem: string;
  userName?: string;
  userEmail?: string;
}

const SUPPORT_API_URL = `https://ihkbxdayhdewqzezdrfl.supabase.co/functions/v1/support-ticket`;

export function SupportWidget({ clientSystem, userName, userEmail }: SupportWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tipo, setTipo] = useState('');
  const [prioridade, setPrioridade] = useState('media');
  const [descricao, setDescricao] = useState('');
  const [anexo, setAnexo] = useState<{ base64: string; nome: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Apenas imagens são aceitas', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem deve ter no máximo 5MB', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAnexo({ base64: reader.result as string, nome: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!tipo || !descricao) {
      toast({ title: 'Preencha tipo e descrição', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const res = await fetch(SUPPORT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          descricao,
          prioridade,
          usuario_email: userEmail,
          userName,
          clientSystem,
          anexo_base64: anexo?.base64 || null,
          anexo_nome: anexo?.nome || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTicketNumber(data.ticket_number);
        toast({ title: `Ticket ${data.ticket_number} criado com sucesso!` });
      } else {
        throw new Error(data.error || 'Erro ao enviar');
      }
    } catch (err: any) {
      toast({ title: 'Erro ao enviar ticket', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setTipo('');
    setPrioridade('media');
    setDescricao('');
    setAnexo(null);
    setTicketNumber('');
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:scale-110 transition-transform"
          aria-label="Abrir suporte"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Widget panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-h-[500px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
            <span className="font-semibold text-sm">Suporte Técnico</span>
            <button onClick={() => { setIsOpen(false); resetForm(); }}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {ticketNumber ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle className="h-12 w-12 text-primary" />
                <p className="font-semibold text-lg">Ticket Enviado!</p>
                <p className="text-sm text-muted-foreground">Número: <strong>{ticketNumber}</strong></p>
                <a
                  href="/minha-conta/chamados"
                  className="text-xs text-primary underline hover:opacity-80"
                >
                  Acompanhar meus chamados
                </a>
                <Button size="sm" onClick={resetForm}>Novo Ticket</Button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo *</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Erro">Erro / Bug</SelectItem>
                      <SelectItem value="Duvida">Dúvida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Prioridade</Label>
                  <Select value={prioridade} onValueChange={setPrioridade}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Descrição *</Label>
                  <Textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Descreva o problema ou dúvida..."
                    className="text-sm min-h-[80px]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Anexo (imagem, máx 5MB)</Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip className="h-3 w-3 mr-1" />
                    {anexo ? anexo.nome : 'Selecionar imagem'}
                  </Button>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={sending}
                  className="w-full"
                  size="sm"
                >
                  <Send className="h-4 w-4 mr-1" />
                  {sending ? 'Enviando...' : 'Enviar Ticket'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
