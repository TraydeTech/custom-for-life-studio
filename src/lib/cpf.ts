/**
 * Utilitários de CPF (validação, máscara, normalização).
 *
 * - `unmaskCPF` remove qualquer caractere não numérico.
 * - `maskCPF` aplica o formato 000.000.000-00 progressivamente.
 * - `isValidCPF` valida os dígitos verificadores e rejeita sequências
 *   repetidas (000.000.000-00, 111.111.111-11, etc.).
 */

export function unmaskCPF(value: string): string {
  return (value || '').replace(/\D/g, '').slice(0, 11);
}

export function maskCPF(value: string): string {
  const digits = unmaskCPF(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function isValidCPF(value: string): boolean {
  const cpf = unmaskCPF(value);
  if (cpf.length !== 11) return false;
  // Sequências repetidas são inválidas
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (slice: string, factor: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice[i], 10) * (factor - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  if (d1 !== parseInt(cpf[9], 10)) return false;
  const d2 = calcDigit(cpf.slice(0, 10), 11);
  if (d2 !== parseInt(cpf[10], 10)) return false;

  return true;
}
