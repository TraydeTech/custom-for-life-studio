import { useState, useEffect } from 'react';
import { MessageCircle, X, Construction, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WHATSAPP_NUMBER = '5547984492949';
const WHATSAPP_MESSAGE = encodeURIComponent('Olá! Vim pelo site e gostaria de solicitar um orçamento de brindes personalizados.');

export function TestModeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const interval = setInterval(() => setVisible(true), 15000);
    return () => clearInterval(interval);
  }, []);

  const dismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-lg animate-in fade-in zoom-in-95 duration-300">
        {/* Glow border effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-orange-400 to-primary rounded-3xl blur opacity-75 animate-pulse" />

        <div className="relative bg-zinc-950 rounded-3xl overflow-hidden">
          {/* Top banner stripe */}
          <div className="bg-gradient-to-r from-primary to-orange-500 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Construction className="h-4 w-4 text-white" />
              <span className="text-white text-xs font-bold uppercase tracking-widest">Em desenvolvimento</span>
            </div>
            <button
              onClick={dismiss}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-8 text-center">
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                <div className="relative bg-primary/10 border border-primary/30 rounded-full p-5">
                  <ShoppingBag className="h-10 w-10 text-primary" />
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-heading font-bold text-white mb-1">
              Site em fase de testes
            </h2>
            <p className="text-primary font-medium text-sm mb-5">
              Estamos quase prontos! 🚀
            </p>

            {/* Info cards */}
            <div className="space-y-3 mb-7 text-left">
              <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                <span className="text-yellow-400 text-lg mt-0.5">⚠️</span>
                <p className="text-yellow-200 text-sm leading-relaxed">
                  <span className="font-semibold">Produtos não estão à venda ainda.</span> Os itens exibidos são apenas demonstrações do catálogo e não podem ser comprados no momento.
                </p>
              </div>

              <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <span className="text-green-400 text-lg mt-0.5">✅</span>
                <p className="text-green-200 text-sm leading-relaxed">
                  <span className="font-semibold">Já estamos atendendo!</span> Entre em contato pelo WhatsApp para solicitar seu orçamento personalizado.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                className="w-full h-12 rounded-full gap-2 text-base font-semibold shadow-lg shadow-green-900/30"
                style={{ backgroundColor: '#25D366' }}
                asChild
              >
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-5 w-5" />
                  Falar no WhatsApp
                </a>
              </Button>

              <button
                onClick={dismiss}
                className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors py-1"
              >
                Entendi, quero navegar no site
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
