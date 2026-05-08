import { MessageCircle } from 'lucide-react';

const WHATSAPP_NUMBER = '5511999999999'; // Substituir pelo número real
const WHATSAPP_MESSAGE = encodeURIComponent('Olá! Vim pelo site e gostaria de saber mais sobre os produtos personalizados.');

export function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
      style={{ backgroundColor: '#25D366' }}
    >
      <MessageCircle className="h-7 w-7 text-white fill-white" />
    </a>
  );
}
