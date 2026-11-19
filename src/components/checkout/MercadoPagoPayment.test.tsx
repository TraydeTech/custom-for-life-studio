import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoPayment, type PayResult } from './MercadoPagoPayment';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn().mockResolvedValue({ data: { paid: false, status: 'pending' } }) } },
}));

const PIX_CODE = '00020126580014br.gov.bcb.pix0136b454ab2b-35c7-4f71-a231-3ba01f84b0d35204000053039865405' +
  '5.005802BR5925CUSTOM FOR LIFE6009BLUMENAU62070503***6304ABCD';

// Simula o SDK do Mercado Pago: o Brick envia um pagamento Pix assim que é criado.
function mockSdk() {
  type Settings = { callbacks: { onReady: () => void; onSubmit: (p: unknown) => Promise<void> } };
  (window as unknown as { MercadoPago: unknown }).MercadoPago = class {
    bricks() {
      return {
        create: async (_type: string, id: string, settings: Settings) => {
          // Como o SDK real: guarda o elemento do container e o esvazia/remove no unmount.
          const container = document.getElementById(id)!;
          container.innerHTML = '<iframe title="mp-brick"></iframe>';
          settings.callbacks.onReady();
          await settings.callbacks.onSubmit({ selectedPaymentMethod: 'bank_transfer', formData: {} });
          return { unmount: () => { container.innerHTML = ''; container.remove(); } };
        },
      };
    }
  };
}

describe('MercadoPagoPayment — Pix', () => {
  beforeEach(() => mockSdk());

  it('mostra o QR Code, o código copia e cola e o botão de copiar', async () => {
    const onPay = vi.fn().mockResolvedValue({
      orderId: 'o1', orderNumber: 'CFL-1', status: 'pix', pixQrCode: PIX_CODE,
    } satisfies PayResult);

    render(<MercadoPagoPayment amount={5} payerEmail="cliente@exemplo.com" onPay={onPay} onFinished={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /copiar código pix/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/código pix copia e cola/i)).toHaveValue(PIX_CODE);
    expect(screen.getByText(/pague r\$\s*5,00 com pix/i)).toBeInTheDocument();
    await waitFor(() => expect(onPay).toHaveBeenCalledTimes(1));
  });
});
