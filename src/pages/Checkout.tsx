import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import {
  ChevronLeft, ChevronRight, MapPin, User, CreditCard, Loader2,
  QrCode, Lock, Copy, CheckCircle, Clock, Banknote, Truck, Store, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { maskCPF, unmaskCPF, isValidCPF } from '@/lib/cpf';
import { buildInstallmentOptions } from '@/lib/installments';
import { PAYMENT_ENABLED, buildWhatsAppOrderLink } from '@/lib/store-config';

// Mercado Pago JS SDK v2 (https://sdk.mercadopago.com/js/v2) — tokeniza o
// cartão no navegador; os dados do cartão nunca chegam ao nosso servidor.
interface MercadoPagoInstance {
  createCardToken(data: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }): Promise<{ id: string }>;
  getPaymentMethods(data: { bin: string }): Promise<{
    results: { id: string; payment_type_id: string; issuer?: { id: number | string } }[];
  }>;
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
  }
}

const MP_PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY as string | undefined;
const PIX_POLL_MS = 5000;

const WHATSAPP_NUMBER = '5547984492949';
// Cidade com frete grátis (comparação sem acento/maiúsculas).
const FREE_SHIPPING_CITY = 'blumenau';

// Endereço de retirada na loja.
// PREENCHER com o endereço real e trocar `filled` para true.
// Enquanto `filled` for false, o site mostra "combinar pelo WhatsApp".
const STORE_PICKUP = {
  filled: true,
  address: 'Rua Leopoldo dos Santos, 591 - Blumenau/SC',
  hours: 'Seg a Sex, 9h às 18h',
};

const normalizeCity = (c: string) =>
  c.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

interface CustomerData {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

interface AddressData {
  id?: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cartItems, cartTotal: liveCartTotal, clearCart } = useCart();
  const [fixedTotal, setFixedTotal] = useState<number | null>(null);
  const cartTotal = fixedTotal ?? liveCartTotal;
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');

  const [customer, setCustomer] = useState<CustomerData>({
    name: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    phone: '',
    cpf: '',
  });

  const [address, setAddress] = useState<AddressData>({
    zip_code: '', street: '', number: '', complement: '',
    neighborhood: '', city: '', state: '',
  });

  const [userAddresses, setUserAddresses] = useState<AddressData[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');
  const [showAuthModal, setShowAuthModal] = useState(!user);

  // Payment state
  const [paymentTab, setPaymentTab] = useState('pix');
  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);
  const [pixData, setPixData] = useState<{
    qrCodeText: string;
    qrCodeBase64?: string;
    orderNumber: string;
    paymentId: string;
  } | null>(null);
  const [isCheckingPix, setIsCheckingPix] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Card state (disabled for now)
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [installments, setInstallments] = useState('1');

  const checkIntervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Carrega o SDK do Mercado Pago via DOM (script tag em JSX não executa)
  useEffect(() => {
    if (window.MercadoPago) return;
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    document.head.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  // Prefill from profile
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, cpf, email')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) {
        setCustomer(prev => ({
          ...prev,
          name: profile.full_name || prev.name,
          phone: profile.phone || prev.phone,
          cpf: maskCPF(profile.cpf || '') || prev.cpf,
          email: profile.email || prev.email,
        }));
      }
      
      const { data: addrList } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      
      if (addrList && addrList.length > 0) {
        setUserAddresses(addrList);
        const defaultAddr = addrList.find(a => a.is_default) || addrList[0];
        setSelectedAddressId(defaultAddr.id);
        setAddress({
          id: defaultAddr.id,
          zip_code: defaultAddr.zip_code || '', 
          street: defaultAddr.street || '',
          number: defaultAddr.number || '', 
          complement: defaultAddr.complement || '',
          neighborhood: defaultAddr.neighborhood || '', 
          city: defaultAddr.city || '',
          state: defaultAddr.state || '',
        });
      }
    };
    loadProfile();
  }, [user]);

  // Cleanup intervals
  useEffect(() => {
    const checkInterval = checkIntervalRef;
    const timer = timerRef;
    return () => {
      if (checkInterval.current) clearInterval(checkInterval.current);
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  // Polling do PIX: consulta o status até o pagamento ser aprovado.
  useEffect(() => {
    if (!pixData?.paymentId) return;
    const id = window.setInterval(() => {
      checkPixStatus(false);
    }, PIX_POLL_MS);
    checkIntervalRef.current = id;
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixData?.paymentId]);

  // We allow visitors to proceed, but they'll see the auth modal if they aren't logged in when finishing
  const isGuest = !user;

  if (cartItems.length === 0 && !orderId) {
    navigate('/carrinho');
    return null;
  }

  const handleAddressSelect = (id: string) => {
    setSelectedAddressId(id);
    if (id === 'new') {
      setAddress({
        zip_code: '', street: '', number: '', complement: '',
        neighborhood: '', city: '', state: '',
      });
    } else {
      const addr = userAddresses.find(a => a.id === id);
      if (addr) {
        setAddress({ ...addr });
      }
    }
  };

  const handleCepBlur = async () => {
    const cep = address.zip_code.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddress(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      } else toast.error('CEP não encontrado');
    } catch { toast.error('Erro ao buscar CEP'); }
    finally { setIsFetchingCep(false); }
  };

  const canProceedStep1 =
    customer.name.trim() &&
    customer.email.trim() &&
    customer.phone.trim() &&
    isValidCPF(customer.cpf);
  const isPickup = deliveryMethod === 'pickup';
  const isBlumenau = normalizeCity(address.city) === FREE_SHIPPING_CITY;
  const canProceedStep2 = isPickup
    ? true
    : Boolean(address.zip_code.trim() && address.street.trim() && address.number.trim() && address.neighborhood.trim() && address.city.trim() && address.state.trim());

  const formatCardNumber = (v: string) => v.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19);
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length >= 2) return `${d.slice(0, 2)}/${d.slice(2, 4)}`;
    return d;
  };

  const validateStockAtCheckout = async () => {
    for (const item of cartItems) {
      const { data: product } = await supabase
        .from('products')
        .select('stock, name')
        .eq('id', item.product_id)
        .maybeSingle();
      if (!product) throw new Error(`Produto não encontrado: ${item.product?.name}`);
      if (product.stock < item.quantity) {
        throw new Error(
          `Estoque insuficiente para "${product.name}". Disponível: ${product.stock} unidade(s).`
        );
      }
    }
  };

  const createOrder = async () => {
    await validateStockAtCheckout();
    // 1. Atualizar CRM (Perfil)
    if (user) {
      await supabase.from('profiles').upsert({
        user_id: user.id,
        full_name: customer.name,
        phone: customer.phone,
        cpf: unmaskCPF(customer.cpf),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      // 2. Salvar/Atualizar Endereço no CRM (só quando é entrega)
      if (!isPickup) {
      const addressPayload = {
        user_id: user.id,
        zip_code: address.zip_code,
        street: address.street,
        number: address.number,
        complement: address.complement,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        is_default: selectedAddressId === 'new' && userAddresses.length === 0,
      };

      if (selectedAddressId !== 'new') {
        await supabase.from('addresses').update(addressPayload).eq('id', selectedAddressId).eq('user_id', user.id);
      } else {
        // Verifica se este endereço já existe para evitar duplicatas básicas
        const { data: existingAddr } = await supabase
          .from('addresses')
          .select('id')
          .eq('user_id', user.id)
          .eq('zip_code', address.zip_code)
          .eq('number', address.number)
          .maybeSingle();
        
        if (!existingAddr) {
          await supabase.from('addresses').insert(addressPayload);
        }
      }
      } // fecha if (!isPickup)
    }

    // Resumo da entrega para a loja identificar frete/retirada no pedido.
    const deliveryLabel = isPickup
      ? 'Retirada na loja'
      : isBlumenau
        ? `Entrega ${address.city}/${address.state} — frete grátis (Blumenau)`
        : `Entrega ${address.city}/${address.state} — frete a combinar pelo WhatsApp`;

    const shippingAddress = isPickup
      ? {
          name: customer.name, phone: customer.phone,
          delivery_method: 'pickup' as const,
        }
      : {
          name: customer.name, phone: customer.phone,
          street: address.street, number: address.number,
          complement: address.complement, neighborhood: address.neighborhood,
          city: address.city, state: address.state, zip_code: address.zip_code,
          delivery_method: 'delivery' as const,
          free_shipping: isBlumenau,
        };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        subtotal: cartTotal, total: cartTotal,
        shipping_address: shippingAddress,
        status: 'pending', payment_status: 'pending',
        notes: `Cliente: ${customer.name} | Tel: ${customer.phone} | CPF: ${customer.cpf || 'N/A'} | ${deliveryLabel}`,
        order_number: 'temp', source: 'site',
      })
      .select()
      .single();

    if (orderError) throw orderError;
    if (!order?.order_number || order.order_number === 'temp' || order.order_number.startsWith('temp')) {
      console.error('[Checkout] order_number não foi gerado pelo backend:', order);
      throw new Error('Não foi possível gerar o número do pedido. Tente novamente em instantes.');
    }

    for (const item of cartItems) {
      let engravingPreviewUrl: string | null = null;
      if (item.engraving_preview_image?.startsWith('data:')) {
        try {
          const base64Data = item.engraving_preview_image.split(',')[1];
          const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          // Bucket engravings: pasta raiz = id do usuário (exigido pela RLS).
          const fileName = `${user.id}/${order.id}/${item.id}-${Date.now()}.png`;
          const { error: uploadError } = await supabase.storage
            .from('engravings')
            .upload(fileName, byteArray, { contentType: 'image/png' });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('engravings').getPublicUrl(fileName);
            engravingPreviewUrl = urlData.publicUrl;
          }
        } catch (e) { console.error('Upload failed:', e); }
      }

      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product?.name || 'Produto',
        product_image: item.product?.images?.[0] || null,
        quantity: item.quantity,
        unit_price: item.product?.price || 0,
        total_price: (item.product?.price || 0) * item.quantity,
        customization_notes: item.customization_notes,
        engraving_text: item.engraving_text,
        engraving_position_x: item.engraving_position_x,
        engraving_position_y: item.engraving_position_y,
        engraving_preview_url: engravingPreviewUrl,
        engraving_file_url: item.engraving_file_url,
        product_color: item.product_color,
      });
    }

    setOrderId(order.id);
    return order;
  };

  const handlePixPayment = async () => {
    setIsGeneratingPayment(true);
    try {
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      // Fix the total before clearing the cart
      setFixedTotal(liveCartTotal);
      const order = orderId ? { id: orderId } : await createOrder();
      const orderNumber = (order as { order_number?: string }).order_number || '';

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          orderId: order.id,
          paymentMethod: 'pix',
          customerName: customer.name,
          customerEmail: customer.email,
          customerCpf: unmaskCPF(customer.cpf),
        },
      });
      if (error) throw error;
      if (data?.error || !data?.pixQrCodeText) throw new Error(data?.message || data?.error || 'Erro ao gerar PIX');

      setPixData({
        qrCodeText: data.pixQrCodeText,
        qrCodeBase64: data.pixQrCodeBase64,
        orderNumber,
        paymentId: String(data.paymentId),
      });

      // Clear cart after generating PIX to prevent double orders
      await clearCart.mutateAsync();

      toast.success('PIX gerado! Pague pelo app do seu banco — a confirmação é automática.');
    } catch (error) {
      console.error('PIX error:', error);
      toast.error((error instanceof Error && error.message) || 'Erro ao gerar PIX');
    } finally {
      setIsGeneratingPayment(false);
    }
  };

  const checkPixStatus = async (manual: boolean) => {
    if (!pixData) return;
    if (manual) setIsCheckingPix(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { paymentId: pixData.paymentId },
      });
      if (error) throw error;
      if (data?.paid) {
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        toast.success('Pagamento confirmado!');
        navigate(`/pedido-confirmado?pedido=${pixData.orderNumber}`);
      } else if (data?.status === 'cancelled' || data?.status === 'rejected') {
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        toast.error('PIX expirado. Gere um novo código.');
        setPixData(null);
      } else if (manual) {
        toast.info('Ainda não recebemos o pagamento. Aguarde alguns segundos e tente de novo.');
      }
    } catch (error) {
      console.error('PIX status error:', error);
      if (manual) toast.error('Não foi possível verificar o pagamento agora.');
    } finally {
      if (manual) setIsCheckingPix(false);
    }
  };

  const handleCardPayment = async (type: 'credit_card' | 'debit_card') => {
    if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
      toast.error('Preencha todos os dados do cartão');
      return;
    }

    setIsSubmitting(true);
    try {
      // Se for convidado, abre o modal de auth antes de criar o pedido
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      const order = orderId ? { id: orderId } : await createOrder();

      // Tokeniza via Mercado Pago JS SDK
      if (!window.MercadoPago || !MP_PUBLIC_KEY) {
        toast.error('Sistema de pagamento não carregado. Recarregue a página.');
        return;
      }
      const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });

      const number = cardNumber.replace(/\s/g, '');
      const { results } = await mp.getPaymentMethods({ bin: number.slice(0, 8) });
      const method = results.find(r => r.payment_type_id === type) || results[0];
      if (!method) throw new Error('Bandeira do cartão não reconhecida');
      if (method.payment_type_id !== type) {
        throw new Error(type === 'debit_card'
          ? 'Este cartão não aceita débito. Use a opção Crédito.'
          : 'Este cartão não aceita crédito. Use a opção Débito.');
      }

      const [expMonth, expYear] = cardExpiry.split('/');
      const tokenData = await mp.createCardToken({
        cardNumber: number,
        cardholderName: cardName,
        cardExpirationMonth: expMonth,
        cardExpirationYear: `20${expYear}`,
        securityCode: cardCvv,
        identificationType: 'CPF',
        identificationNumber: unmaskCPF(customer.cpf),
      }).catch(() => { throw new Error('Dados do cartão inválidos'); });

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          orderId: order.id,
          paymentMethod: type,
          token: tokenData.id,
          paymentMethodId: method.id,
          issuerId: method.issuer?.id,
          installments: type === 'credit_card' ? parseInt(installments) : 1,
          customerName: customer.name,
          customerEmail: customer.email,
          customerCpf: unmaskCPF(customer.cpf),
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.message || data.error);

      await clearCart.mutateAsync();
      if (data.status === 'pending') toast.info(data.message || 'Pagamento em análise.');
      else toast.success('Pagamento aprovado!');
      navigate(`/pedido-confirmado?pedido=${(order as { order_number?: string }).order_number || ''}`);
    } catch (error) {
      console.error('Card error:', error);
      toast.error((error instanceof Error && error.message) || 'Cartão recusado. Verifique os dados ou tente outro cartão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPixCode = () => {
    if (pixData?.qrCodeText) {
      navigator.clipboard.writeText(pixData.qrCodeText);
      toast.success('Código PIX copiado!');
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const installmentOptions = buildInstallmentOptions(cartTotal);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      <main className="flex-1 container py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Finalizar Compra</h1>

        {!PAYMENT_ENABLED && (
          <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3">
            <MessageCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-yellow-700">Pagamento online em manutenção</p>
              <p className="text-muted-foreground">
                No momento os pedidos e pagamentos são finalizados pelo WhatsApp. Revise seu pedido e clique em “Pedir pelo WhatsApp”.
              </p>
              <a
                href={buildWhatsAppOrderLink(cartItems, cartTotal)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm font-semibold text-green-600 hover:underline"
              >
                <MessageCircle className="h-4 w-4" /> Pedir pelo WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { n: 1, label: 'Dados', icon: User },
            { n: 2, label: 'Endereço', icon: MapPin },
            { n: 3, label: 'Pagamento', icon: CreditCard },
          ].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {n}
              </div>
              <span className={`text-sm hidden sm:inline ${step >= n ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              {n < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 1 — Customer Data */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div><Label htmlFor="name">Nome completo *</Label><Input id="name" value={customer.name} onChange={e => setCustomer(prev => ({ ...prev, name: e.target.value }))} placeholder="Seu nome completo" /></div>
              <div><Label htmlFor="email">E-mail *</Label><Input id="email" type="email" value={customer.email} onChange={e => setCustomer(prev => ({ ...prev, email: e.target.value }))} placeholder="seu@email.com" /></div>
              <div><Label htmlFor="phone">WhatsApp / Telefone *</Label><Input id="phone" value={customer.phone} onChange={e => setCustomer(prev => ({ ...prev, phone: e.target.value }))} placeholder="(11) 99999-9999" /></div>
              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={customer.cpf}
                  onChange={e => setCustomer(prev => ({ ...prev, cpf: maskCPF(e.target.value) }))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                />
                {customer.cpf.length > 0 && unmaskCPF(customer.cpf).length === 11 && !isValidCPF(customer.cpf) && (
                  <p className="text-sm text-destructive mt-1">CPF inválido. Verifique os dígitos.</p>
                )}
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>Próximo<ChevronRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Address */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Forma de Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Escolha: entrega no endereço ou retirada na loja */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('delivery')}
                  className={`border rounded-xl p-3 text-left transition-all ${!isPickup ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium"><Truck className="h-4 w-4" /> Entrega</div>
                  <p className="text-xs text-muted-foreground mt-1">Receber no seu endereço</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('pickup')}
                  className={`border rounded-xl p-3 text-left transition-all ${isPickup ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium"><Store className="h-4 w-4" /> Retirar na loja</div>
                  <p className="text-xs text-muted-foreground mt-1">Sem frete</p>
                </button>
              </div>

              {isPickup ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-sm">
                  <p className="font-semibold flex items-center gap-2"><Store className="h-4 w-4 text-primary" /> Retirada na loja</p>
                  {STORE_PICKUP.filled ? (
                    <>
                      <p>{STORE_PICKUP.address}</p>
                      {STORE_PICKUP.hours && <p className="text-muted-foreground">{STORE_PICKUP.hours}</p>}
                    </>
                  ) : (
                    <p className="text-muted-foreground">Combinamos o local e horário de retirada pelo WhatsApp após o pedido.</p>
                  )}
                  <p className="text-primary font-medium">Sem custo de frete.</p>
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Fiz um pedido no site para retirar na loja e gostaria de combinar a retirada.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary text-xs font-semibold hover:underline"
                  >
                    Combinar retirada pelo WhatsApp
                  </a>
                </div>
              ) : (
              <>
              {user && userAddresses.length > 0 && (
                <div className="mb-6">
                  <Label>Selecione um endereço salvo</Label>
                  <Select value={selectedAddressId} onValueChange={handleAddressSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um endereço" />
                    </SelectTrigger>
                    <SelectContent>
                      {userAddresses.map((addr) => (
                        <SelectItem key={addr.id} value={addr.id!}>
                          {addr.street}, {addr.number} - {addr.city}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">+ Adicionar novo endereço</SelectItem>
                    </SelectContent>
                  </Select>
                  <Separator className="mt-4" />
                </div>
              )}
              <div className="flex gap-2">
                <div className="flex-1"><Label htmlFor="cep">CEP *</Label><Input id="cep" value={address.zip_code} onChange={e => setAddress(prev => ({ ...prev, zip_code: e.target.value }))} onBlur={handleCepBlur} placeholder="00000-000" maxLength={9} /></div>
                {isFetchingCep && <Loader2 className="h-5 w-5 animate-spin mt-8" />}
              </div>
              <div><Label htmlFor="street">Rua *</Label><Input id="street" value={address.street} onChange={e => setAddress(prev => ({ ...prev, street: e.target.value }))} placeholder="Rua, Avenida..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="number">Número *</Label><Input id="number" value={address.number} onChange={e => setAddress(prev => ({ ...prev, number: e.target.value }))} placeholder="123" /></div>
                <div><Label htmlFor="complement">Complemento</Label><Input id="complement" value={address.complement} onChange={e => setAddress(prev => ({ ...prev, complement: e.target.value }))} placeholder="Apto, bloco..." /></div>
              </div>
              <div><Label htmlFor="neighborhood">Bairro *</Label><Input id="neighborhood" value={address.neighborhood} onChange={e => setAddress(prev => ({ ...prev, neighborhood: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2"><Label htmlFor="city">Cidade *</Label><Input id="city" value={address.city} onChange={e => setAddress(prev => ({ ...prev, city: e.target.value }))} /></div>
                <div><Label htmlFor="state">Estado *</Label><Input id="state" value={address.state} onChange={e => setAddress(prev => ({ ...prev, state: e.target.value }))} maxLength={2} placeholder="SP" /></div>
              </div>

              {/* Aviso de frete conforme a cidade */}
              {address.city.trim() && (
                <div className={`rounded-lg p-3 text-sm font-medium ${isBlumenau ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-muted text-muted-foreground border'}`}>
                  {isBlumenau
                    ? '🎉 Frete grátis para Blumenau!'
                    : 'Frete a combinar pelo WhatsApp — sem cobrança online.'}
                </div>
              )}
              </>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="mr-2 h-4 w-4" />Voltar</Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>Próximo<ChevronRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Payment */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader><CardTitle>Resumo do Pedido</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3 pb-3 border-b last:border-0">
                    <img src={item.engraving_preview_image || item.product?.images?.[0] || '/placeholder.svg'} alt={item.product?.name} className="w-16 h-16 object-contain rounded-lg" loading="lazy" width={64} height={64} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.product?.name}{item.product_color && ` — ${item.product_color}`}</p>
                      {item.engraving_text && <p className="text-xs text-muted-foreground">Gravação: "{item.engraving_text}"</p>}
                      <p className="text-sm mt-1">{item.quantity}x {formatCurrency(item.product?.price || 0)} = {formatCurrency((item.product?.price || 0) * item.quantity)}</p>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(cartTotal)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Info */}
            <Card>
              <CardHeader><CardTitle>{isPickup ? 'Retirada na loja' : 'Dados da Entrega'}</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>{customer.name}</strong></p>
                <p>{customer.email} | {customer.phone}</p>
                {isPickup ? (
                  STORE_PICKUP.filled
                    ? <p>{STORE_PICKUP.address}</p>
                    : <p className="text-muted-foreground">Retirada combinada pelo WhatsApp — sem frete.</p>
                ) : (
                  <>
                    <p>{address.street}, {address.number}{address.complement ? ` - ${address.complement}` : ''}</p>
                    <p>{address.neighborhood}, {address.city}/{address.state} - CEP: {address.zip_code}</p>
                    <p className={isBlumenau ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                      {isBlumenau ? 'Frete grátis (Blumenau)' : 'Frete a combinar pelo WhatsApp'}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />Pagamento
                </CardTitle>
                {PAYMENT_ENABLED && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Lock className="h-3 w-3" />
                    Pagamento seguro — seus dados são criptografados
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {!PAYMENT_ENABLED ? (
                  <div className="text-center space-y-4 py-4">
                    <MessageCircle className="h-14 w-14 mx-auto text-primary" />
                    <p className="text-muted-foreground text-sm">
                      Para pagar e concluir seu pedido, fale com a gente no WhatsApp. Enviamos as formas de pagamento por lá.
                    </p>
                    <Button size="lg" className="gap-2" style={{ backgroundColor: '#25D366' }} asChild>
                      <a href={buildWhatsAppOrderLink(cartItems, cartTotal)} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-5 w-5" /> Pedir pelo WhatsApp
                      </a>
                    </Button>
                  </div>
                ) : (
                <Tabs value={paymentTab} onValueChange={setPaymentTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="pix" className="gap-2"><QrCode className="h-4 w-4" />PIX</TabsTrigger>
                    <TabsTrigger value="credit" className="gap-2"><CreditCard className="h-4 w-4" />Crédito</TabsTrigger>
                    <TabsTrigger value="debit" className="gap-2"><Banknote className="h-4 w-4" />Débito</TabsTrigger>
                  </TabsList>

                  {/* PIX Tab */}
                  <TabsContent value="pix" className="space-y-4 pt-4">
                    {!pixData ? (
                      <div className="text-center space-y-4">
                        <QrCode className="h-16 w-16 mx-auto text-primary" />
                        <p className="text-muted-foreground">Gere o QR Code PIX para pagamento instantâneo</p>
                        <Button size="lg" onClick={handlePixPayment} disabled={isGeneratingPayment} className="gap-2">
                          {isGeneratingPayment ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando...</> : <><QrCode className="h-5 w-5" />Gerar PIX — {formatCurrency(cartTotal)}</>}
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="bg-white p-4 rounded-lg inline-block">
                          {pixData.qrCodeBase64
                            ? <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" width={192} height={192} />
                            : <QRCodeSVG value={pixData.qrCodeText} size={192} />}
                        </div>
                        <div className="bg-muted p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-2">Código PIX copia e cola:</p>
                          <div className="flex gap-2">
                            <Input value={pixData.qrCodeText} readOnly className="text-xs font-mono" />
                            <Button variant="outline" size="icon" onClick={copyPixCode}><Copy className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex gap-3 text-left">
                          <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-primary flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />Aguardando pagamento
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Pague pelo app do seu banco. A confirmação é automática e esta página atualiza sozinha.
                            </p>
                          </div>
                        </div>
                        <Button 
                          className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700" 
                          onClick={() => checkPixStatus(true)}
                          disabled={isCheckingPix}
                        >
                          {isCheckingPix ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Já realizei o pagamento'}
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  {/* Credit Card Tab */}
                  <TabsContent value="credit" className="space-y-4 pt-4">
                    <CardForm
                      cardNumber={cardNumber} setCardNumber={setCardNumber}
                      cardName={cardName} setCardName={setCardName}
                      cardExpiry={cardExpiry} setCardExpiry={setCardExpiry}
                      cardCvv={cardCvv} setCardCvv={setCardCvv}
                      formatCardNumber={formatCardNumber}
                      formatExpiry={formatExpiry}
                      isCredit={true}
                      installments={installments} setInstallments={setInstallments}
                      installmentOptions={installmentOptions}
                      isSubmitting={isSubmitting}
                      onSubmit={() => handleCardPayment('credit_card')}
                      total={cartTotal}
                    />
                  </TabsContent>

                  {/* Debit Card Tab */}
                  <TabsContent value="debit" className="space-y-4 pt-4">
                    <CardForm
                      cardNumber={cardNumber} setCardNumber={setCardNumber}
                      cardName={cardName} setCardName={setCardName}
                      cardExpiry={cardExpiry} setCardExpiry={setCardExpiry}
                      cardCvv={cardCvv} setCardCvv={setCardCvv}
                      formatCardNumber={formatCardNumber}
                      formatExpiry={formatExpiry}
                      isCredit={false}
                      installments={installments} setInstallments={setInstallments}
                      installmentOptions={installmentOptions}
                      isSubmitting={isSubmitting}
                      onSubmit={() => handleCardPayment('debit_card')}
                      total={cartTotal}
                    />
                  </TabsContent>
                </Tabs>
                )}

                <div className="flex justify-start mt-6">
                  <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="mr-2 h-4 w-4" />Voltar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

interface CardFormProps {
  cardNumber: string; setCardNumber: (v: string) => void;
  cardName: string; setCardName: (v: string) => void;
  cardExpiry: string; setCardExpiry: (v: string) => void;
  cardCvv: string; setCardCvv: (v: string) => void;
  formatCardNumber: (v: string) => string;
  formatExpiry: (v: string) => string;
  isCredit: boolean;
  installments: string; setInstallments: (v: string) => void;
  installmentOptions: { value: string; label: string }[];
  isSubmitting: boolean;
  onSubmit: () => void;
  total: number;
}

function CardForm({
  cardNumber, setCardNumber, cardName, setCardName,
  cardExpiry, setCardExpiry, cardCvv, setCardCvv,
  formatCardNumber, formatExpiry, isCredit,
  installments, setInstallments, installmentOptions,
  isSubmitting, onSubmit, total,
}: CardFormProps) {
  return (
    <>
      <div><Label>Número do cartão</Label><Input value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" maxLength={19} /></div>
      <div><Label>Nome impresso no cartão</Label><Input value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())} placeholder="NOME COMO NO CARTÃO" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Validade</Label><Input value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/AA" maxLength={5} /></div>
        <div><Label>CVV</Label><Input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="000" maxLength={4} type="password" /></div>
      </div>
      {isCredit && (
        <div><Label>Parcelas</Label>
          <Select value={installments} onValueChange={setInstallments}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {installmentOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button size="lg" className="w-full gap-2" onClick={onSubmit} disabled={isSubmitting}>
        {isSubmitting
          ? <><Loader2 className="h-4 w-4 animate-spin" />Processando...</>
          : <><Lock className="h-4 w-4" />Pagar {formatCurrency(total)}{!isCredit ? ' no débito' : ''}</>
        }
      </Button>
    </>
  );
}
