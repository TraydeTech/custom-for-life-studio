import { useState, useEffect } from 'react';
import { MessageCircle, X, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WHATSAPP_NUMBER = '5547984492949';
const WHATSAPP_MESSAGE = encodeURIComponent('Olá! Vim pelo site e gostaria de solicitar um orçamento de brindes personalizados.');
const STORAGE_KEY = 'test_banner_dismissed';

export function TestModeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex justify-center mb-4">
          <div className="bg-primary/10 rounded-full p-4">
            <FlaskConical className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h2 className="text-xl font-heading font-bold mb-2">Site em fase de testes</h2>

        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          Estamos finalizando os últimos ajustes. Alguns produtos ainda podem não aparecer,
          mas já estamos atendendo! Entre em contato pelo WhatsApp para solicitar seu orçamento.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            className="w-full rounded-full gap-2"
            style={{ backgroundColor: '#25D366' }}
            asChild
          >
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              Falar no WhatsApp
            </a>
          </Button>

          <Button variant="ghost" className="w-full rounded-full text-sm" onClick={dismiss}>
            Continuar navegando
          </Button>
        </div>
      </div>
    </div>
  );
}
