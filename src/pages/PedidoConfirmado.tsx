import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, ShoppingBag, MessageCircle, Loader2, Clock } from 'lucide-react';

type MpState = 'checking' | 'paid' | 'pending' | 'failed';
const MP_POLL_MS = 4000;
const MP_MAX_POLLS = 15; // ~1 minuto

/** Volta do Mercado Pago: consulta o pagamento (plano B do webhook). */
function useMercadoPagoStatus(orderId: string | null) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<MpState>('checking');

  useEffect(() => {
    if (!orderId) return;
    let polls = 0;
    let timer: number | undefined;
    let stopped = false;
    const check = async () => {
      polls += 1;
      const { data, error } = await supabase.functions.invoke('mercado-pago', {
        body: { action: 'status', order_id: orderId },
      });
      if (stopped) return;
      if (!error && data?.paid) {
        setState('paid');
        queryClient.invalidateQueries({ queryKey: ['cart'] });
        return;
      }
      if (!error && ['cancelled', 'canceled', 'expired', 'failed', 'refunded'].includes(data?.status)) {
        setState('failed');
        return;
      }
      if (polls >= MP_MAX_POLLS) {
        setState('pending');
        return;
      }
      timer = window.setTimeout(check, MP_POLL_MS);
    };
    check();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, queryClient]);

  return state;
}

export default function PedidoConfirmado() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('pedido') || '';
  const mpOrderId = searchParams.get('mp');
  const mpState = useMercadoPagoStatus(mpOrderId);

  if (mpOrderId) {
    const view = {
      checking: { icon: <Loader2 className="h-20 w-20 text-primary animate-spin" />, title: 'Confirmando seu pagamento…', text: 'Aguarde alguns segundos.' },
      paid: { icon: <CheckCircle className="h-20 w-20 text-primary" />, title: 'Pagamento confirmado!', text: 'Seu pedido já entrou em produção. Acompanhe em Meus Pedidos.' },
      pending: { icon: <Clock className="h-20 w-20 text-amber-500" />, title: 'Pagamento em processamento', text: 'Assim que o Mercado Pago confirmar, seu pedido entra em produção automaticamente. Acompanhe em Meus Pedidos.' },
      failed: { icon: <MessageCircle className="h-20 w-20 text-destructive" />, title: 'Pagamento não concluído', text: 'Nenhuma cobrança foi confirmada. Volte ao carrinho para tentar de novo ou fale com a gente no WhatsApp.' },
    }[mpState];

    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-12 flex items-center justify-center">
          <Card className="max-w-lg w-full text-center">
            <CardContent className="pt-8 pb-8 space-y-6">
              <div className="flex justify-center">{view.icon}</div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">{view.title}</h1>
                {orderNumber && (
                  <p className="text-lg text-muted-foreground">
                    Pedido <span className="font-mono font-bold text-foreground">{orderNumber}</span>
                  </p>
                )}
                <p className="text-sm text-muted-foreground">{view.text}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Link to={mpState === 'failed' ? '/carrinho' : '/loja'}>
                  <Button size="lg" className="gap-2 w-full sm:w-auto">
                    <ShoppingBag className="h-4 w-4" />
                    {mpState === 'failed' ? 'Voltar ao carrinho' : 'Continuar Comprando'}
                  </Button>
                </Link>
                <Link to="/minha-conta/pedidos">
                  <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">Meus Pedidos</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container py-12 flex items-center justify-center">
        <Card className="max-w-lg w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="h-20 w-20 text-primary" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Pedido recebido com sucesso!</h1>
              {orderNumber && (
                <p className="text-lg text-muted-foreground">
                  Pedido <span className="font-mono font-bold text-foreground">{orderNumber}</span>
                </p>
              )}
            </div>

            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-3">
              <p className="text-sm font-semibold text-primary">Atenção ao Comprovante</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Para que seu pedido seja liberado e entre em produção, é <strong>obrigatório</strong> o envio do comprovante de pagamento via WhatsApp.
              </p>
              <Button 
                variant="default" 
                className="w-full bg-green-600 hover:bg-green-700 gap-2"
                asChild
              >
                <a 
                  href={`https://wa.me/5547984492949?text=${encodeURIComponent(`Olá! Acabei de realizar o pagamento do pedido ${orderNumber}. Segue o comprovante em anexo.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4" />
                  Enviar Comprovante via WhatsApp
                </a>
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link to="/loja">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  <ShoppingBag className="h-4 w-4" />
                  Continuar Comprando
                </Button>
              </Link>
              <Link to="/minha-conta/pedidos">
                <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                  Meus Pedidos
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
