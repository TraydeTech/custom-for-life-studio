/** Nomes legíveis das formas de pagamento gravadas em orders.payment_method. */
const METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  dinheiro: 'Dinheiro',
  mercado_pago: 'Mercado Pago',
  whatsapp: 'Combinado pelo WhatsApp',
};

export function paymentMethodLabel(method?: string | null, installments?: number | null): string {
  if (!method) return 'Não informado';
  const label = METHOD_LABELS[method] ?? method;
  return method === 'credito' && installments && installments > 1 ? `${label} — ${installments}x` : label;
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pago',
  pending: 'Aguardando pagamento',
  processing: 'Em análise',
  failed: 'Não aprovado',
  refunded: 'Estornado',
};

export function paymentStatusLabel(status?: string | null): string {
  return status ? STATUS_LABELS[status] ?? status : 'Não informado';
}
