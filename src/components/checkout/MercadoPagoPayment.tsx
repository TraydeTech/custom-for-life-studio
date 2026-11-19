import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { MERCADO_PAGO_PUBLIC_KEY } from '@/lib/store-config';

/**
 * Checkout Transparente do Mercado Pago (Payment Brick).
 * O formulário do cartão roda em campos seguros do Mercado Pago: o número
 * do cartão nunca passa pelo nosso código nem pelo servidor. O valor cobrado
 * é sempre recalculado no servidor (edge function `mercado-pago`).
 */

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const PUBLIC_KEY = MERCADO_PAGO_PUBLIC_KEY;
const PIX_POLL_MS = 5000;

interface BrickController { unmount: () => void }
interface MercadoPagoSdk {
  bricks: () => { create: (type: string, containerId: string, settings: unknown) => Promise<BrickController> };
}
declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoSdk;
  }
}

export interface PayResult {
  orderId: string;
  orderNumber: string;
  status: 'paid' | 'pending' | 'pix';
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  message?: string;
}

interface Props {
  amount: number;
  payerEmail: string;
  /** Envia o pagamento ao servidor; lança Error com mensagem amigável se recusado. */
  onPay: (payment: { selectedPaymentMethod: string; formData: unknown }) => Promise<PayResult>;
  onFinished: (orderId: string, orderNumber: string) => void;
}

// Script antifraude do Mercado Pago: identifica o aparelho (MP_DEVICE_SESSION_ID).
// Enviar esse ID na cobrança melhora a aprovação de cartões.
const SECURITY_URL = 'https://www.mercadopago.com/v2/security.js';
function loadSecurityScript() {
  if (document.querySelector(`script[src="${SECURITY_URL}"]`)) return;
  const script = document.createElement('script');
  script.src = SECURITY_URL;
  script.setAttribute('view', 'checkout');
  script.async = true;
  document.head.appendChild(script);
}

export function getDeviceId(): string | undefined {
  const id = (window as unknown as { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID;
  return typeof id === 'string' && id ? id : undefined;
}

function loadSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('sdk')));
    if (!existing) {
      script.src = SDK_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export function MercadoPagoPayment({ amount, payerEmail, onPay, onFinished }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pix, setPix] = useState<PayResult | null>(null);
  // Callbacks sempre atuais, sem recriar o formulário a cada render.
  const onPayRef = useRef(onPay);
  const onFinishedRef = useRef(onFinished);
  onPayRef.current = onPay;
  onFinishedRef.current = onFinished;

  // Monta o Payment Brick (cartão de crédito + Pix).
  useEffect(() => {
    if (pix) return;
    if (!PUBLIC_KEY) {
      setLoadError('Pagamento online indisponível no momento.');
      setLoading(false);
      return;
    }
    let controller: BrickController | undefined;
    let cancelled = false;
    loadSecurityScript();

    loadSdk()
      .then(async () => {
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(PUBLIC_KEY, { locale: 'pt-BR' });
        controller = await mp.bricks().create('payment', 'mp-payment-brick', {
          initialization: { amount: Number(amount.toFixed(2)), payer: { email: payerEmail } },
          customization: {
            paymentMethods: { creditCard: 'all', bankTransfer: ['pix'], maxInstallments: 12 },
            visual: { style: { theme: 'dark' } },
          },
          callbacks: {
            onReady: () => setLoading(false),
            onError: (error: unknown) => console.error('Mercado Pago brick error', error),
            onSubmit: async (payment: { selectedPaymentMethod: string; formData: unknown }) => {
              try {
                const result = await onPayRef.current(payment);
                if (result.status === 'pix') {
                  setPix(result);
                } else {
                  if (result.status === 'pending') {
                    toast.info(result.message || 'Pagamento em análise. Avisaremos quando for aprovado.');
                  }
                  onFinishedRef.current(result.orderId, result.orderNumber);
                }
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Pagamento não aprovado.');
                throw error; // o Brick volta ao formulário para nova tentativa
              }
            },
          },
        });
        if (cancelled) controller.unmount();
      })
      .catch(() => {
        setLoadError('Não foi possível carregar o pagamento. Atualize a página.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller?.unmount();
    };
  }, [amount, payerEmail, pix]);

  // Pix: consulta o pagamento até ser confirmado.
  useEffect(() => {
    if (!pix) return;
    let stopped = false;
    const timer = window.setInterval(async () => {
      const { data } = await supabase.functions.invoke('mercado-pago', {
        body: { action: 'status', order_id: pix.orderId },
      });
      if (stopped) return;
      if (data?.paid) {
        clearInterval(timer);
        onFinishedRef.current(pix.orderId, pix.orderNumber);
      } else if (['cancelled', 'canceled', 'expired'].includes(data?.status)) {
        clearInterval(timer);
        toast.error('O Pix expirou. Gere um novo pagamento.');
        setPix(null);
      }
    }, PIX_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [pix]);

  const [copied, setCopied] = useState(false);
  const copyPix = async () => {
    if (!pix?.pixQrCode) return;
    try {
      await navigator.clipboard.writeText(pix.pixQrCode);
    } catch {
      // Fallback para navegadores sem acesso à área de transferência.
      const el = document.createElement('textarea');
      el.value = pix.pixQrCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
    }
    setCopied(true);
    toast.success('Código Pix copiado! Cole no app do seu banco.');
    window.setTimeout(() => setCopied(false), 3000);
  };

  if (pix?.pixQrCode) {
    // key diferente: o React cria a tela do Pix do zero em vez de reaproveitar a
    // div do formulário do Mercado Pago (que o SDK esvazia ao desmontar).
    return (
      <div key="pix" className="text-center space-y-4">
        <p className="font-semibold">Pague {formatCurrency(amount)} com Pix</p>
        <div className="bg-white p-4 rounded-lg inline-block">
          {pix.pixQrCodeBase64
            ? <img src={`data:image/png;base64,${pix.pixQrCodeBase64}`} alt="QR Code Pix" width={200} height={200} />
            : <QRCodeSVG value={pix.pixQrCode} size={200} />}
        </div>
        <div className="space-y-2 text-left">
          <p className="text-sm font-medium">Ou copie o código Pix (copia e cola):</p>
          <textarea
            readOnly
            value={pix.pixQrCode}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-none rounded-lg border bg-muted p-3 text-xs font-mono break-all"
            aria-label="Código Pix copia e cola"
          />
          <Button size="lg" className="w-full gap-2" onClick={copyPix}>
            {copied ? <><Check className="h-4 w-4" /> Código copiado!</> : <><Copy className="h-4 w-4" /> Copiar código Pix</>}
          </Button>
          <p className="text-xs text-muted-foreground">
            No app do seu banco, escolha Pix → "Pix copia e cola" e cole o código.
          </p>
        </div>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Aguardando pagamento — esta página atualiza sozinha.
        </p>
      </div>
    );
  }

  return (
    <div key="brick" className="space-y-3">
      {loading && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando formas de pagamento…
        </p>
      )}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      <div id="mp-payment-brick" />
    </div>
  );
}
