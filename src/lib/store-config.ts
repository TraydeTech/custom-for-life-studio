/**
 * Configuração da loja para o período em que o pagamento online ainda
 * não está ativo. Enquanto `PAYMENT_ENABLED` for false, o site esconde
 * os botões de pagamento e direciona o cliente ao WhatsApp para fechar
 * o pedido e combinar o pagamento.
 *
 * Quando o gateway estiver funcionando, trocar para `PAYMENT_ENABLED = true`.
 */

export const WHATSAPP_NUMBER = '5547984492949';

export const PAYMENT_ENABLED = false;

/** Endereço físico da loja. */
export const STORE_ADDRESS = 'Rua Leopoldo dos Santos, 591 - Blumenau/SC';
/** Mapa embutido (iframe) da loja. */
export const STORE_MAPS_EMBED = `https://www.google.com/maps?q=${encodeURIComponent(STORE_ADDRESS)}&output=embed`;
/** Abre o Google Maps na localização da loja. */
export const STORE_MAPS_SEARCH = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_ADDRESS)}`;
/** Abre o Google Maps já traçando rota até a loja ("como chegar"). */
export const STORE_MAPS_DIRECTIONS = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(STORE_ADDRESS)}`;

interface CartLikeItem {
  quantity: number;
  product?: { name?: string | null; price?: number | null } | null;
  product_color?: string | null;
  engraving_text?: string | null;
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

/** Link do WhatsApp com uma mensagem livre. */
export function whatsAppLink(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Link do WhatsApp já com os itens do carrinho na mensagem. */
export function buildWhatsAppOrderLink(items: CartLikeItem[], total: number): string {
  const lines = items.map((it) => {
    const name = it.product?.name ?? 'Item';
    const color = it.product_color ? ` (${it.product_color})` : '';
    const engraving = it.engraving_text ? ` [gravação: ${it.engraving_text}]` : '';
    const lineTotal = (it.product?.price ?? 0) * it.quantity;
    return `• ${it.quantity}x ${name}${color}${engraving} — ${brl(lineTotal)}`;
  });
  const msg =
    'Olá! Quero finalizar meu pedido pelo WhatsApp:\n\n' +
    (lines.length ? lines.join('\n') : '(carrinho vazio)') +
    `\n\nTotal: ${brl(total)}`;
  return whatsAppLink(msg);
}
