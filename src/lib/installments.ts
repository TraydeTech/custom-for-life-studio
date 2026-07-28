/**
 * Configuração única de parcelamento — fonte da verdade para
 * a página do produto, carrinho e checkout.
 *
 * Mantenha em sintonia com a configuração real do gateway Iugu.
 * Confirmado: a loja absorve juros em até 3x. Acima disso o cliente paga
 * juros — a taxa é a da operadora do cartão.
 */

import { formatCurrency } from '@/lib/utils';

export const INSTALLMENT_CONFIG = {
  /** Número máximo de parcelas oferecido no checkout. */
  maxInstallments: 12,
  /** Até quantas parcelas são sem juros (loja absorve). */
  interestFreeUpTo: 3,
  /** Valor mínimo aceitável por parcela (em reais). */
  minInstallmentValue: 5,
  /** Preço mínimo do produto para mostrar a opção de parcelamento.
   *  R$10 garante ao menos 2x (parcela mínima R$5); abaixo disso não parcela. */
  showInstallmentsAbove: 10,
} as const;

/**
 * Texto curto para exibir nas páginas de produto/carrinho.
 * Retorna `null` quando o preço é baixo demais para parcelar.
 */
export function getInstallmentText(price: number): string | null {
  if (!price || price < INSTALLMENT_CONFIG.showInstallmentsAbove) return null;
  const max = computeMaxInstallments(price);
  // Destaca o maior parcelamento SEM juros (mensagem de marketing).
  const interestFree = Math.min(max, INSTALLMENT_CONFIG.interestFreeUpTo);
  const value = price / interestFree;
  return `${interestFree}x de ${formatCurrency(value)} sem juros`;
}

/**
 * Calcula o número máximo de parcelas respeitando o valor mínimo
 * por parcela definido na configuração.
 */
export function computeMaxInstallments(total: number): number {
  if (!total || total <= 0) return 1;
  const byMin = Math.floor(total / INSTALLMENT_CONFIG.minInstallmentValue);
  return Math.max(1, Math.min(INSTALLMENT_CONFIG.maxInstallments, byMin));
}

/**
 * Gera as opções de parcelamento para o select do checkout.
 */
export function buildInstallmentOptions(total: number) {
  const max = computeMaxInstallments(total);
  return Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    const value = total / n;
    const interestNote =
      n === 1
        ? ' (à vista)'
        : n <= INSTALLMENT_CONFIG.interestFreeUpTo
          ? ' sem juros'
          : ' com juros da operadora';
    return { value: String(n), label: `${n}x de ${formatCurrency(value)}${interestNote}` };
  });
}
