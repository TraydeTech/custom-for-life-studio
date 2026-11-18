import { expect, it } from 'vitest';
import { buildWhatsAppOrderLink, PAYMENT_ENABLED } from './store-config';
it('leva cor, gravação e arte ao WhatsApp sem prometer frete grátis geral', () => {
  const url = new URL(buildWhatsAppOrderLink([{ quantity: 1, product: { name: 'Caneca', price: 50 },
    product_color: 'Azul', engraving_text: 'Ana', engraving_file_url: 'https://example.com/art.pdf' }], 50));
  const message = url.searchParams.get('text')!;
  expect(message).toContain('(Azul)');
  expect(message).toContain('[gravação: Ana]');
  expect(message).toContain('Arte: https://example.com/art.pdf');
  expect(message).toContain('frete a confirmar');
  expect(PAYMENT_ENABLED).toBe(false);
});
