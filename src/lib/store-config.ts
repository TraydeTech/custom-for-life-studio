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

/** Frete fixo para entregas fora de Blumenau (o servidor usa o mesmo valor). */
export const FIXED_SHIPPING = 25;
/**
 * Pagamento online pelo Mercado Pago (cartão de crédito e Pix) para todos os clientes.
 * false = desliga e volta para pedidos pelo WhatsApp.
 */
export const MERCADO_PAGO_ENABLED = false;

/** Public Key de PRODUÇÃO do Mercado Pago. Não é secreta (vai para o navegador). */
export const MERCADO_PAGO_PUBLIC_KEY = 'APP_USR-0335e3db-0005-424c-bc17-4f28d92ef9f0';

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
  engraving_file_url?: string | null;
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
    const art = it.engraving_file_url ? `\n  Arte: ${it.engraving_file_url}` : '';
    const lineTotal = (it.product?.price ?? 0) * it.quantity;
    return `• ${it.quantity}x ${name}${color}${engraving} — ${brl(lineTotal)}${art}`;
  });
  const msg =
    'Olá! Quero finalizar meu pedido pelo WhatsApp:\n\n' +
    (lines.length ? lines.join('\n') : '(carrinho vazio)') +
    `\n\nSubtotal dos produtos: ${brl(total)}\nEntrega e frete a confirmar. Entrega grátis para Blumenau.`;
  return whatsAppLink(msg);
}
