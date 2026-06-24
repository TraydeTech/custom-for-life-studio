---
tags: [backend, pagamentos]
---

# Pagamentos (PIX e Iugu)

## PIX
- Gerador de payload **EMV** próprio em `src/lib/pix.ts` (chaves CPF/CNPJ/Email/Telefone).
- QR Code renderizado com `qrcode.react`.
- Chave PIX vem da env **`VITE_PIX_KEY`** → [[Variáveis de Ambiente]].

## Gateway Iugu
- Cobrança/processamento via Edge Functions ([[Supabase - Edge Functions]]):
  - `create-payment` → cria cobrança.
  - `check-payment-status` → consulta status.
  - `iugu-webhook` → recebe atualização e grava `payment_status`/`orders`.

## Parcelamento
- **Fonte única da verdade:** `src/lib/installments.ts`. Usada por **produto**, **carrinho** e **checkout**.
- ⚠️ Manter em sintonia com a configuração real do gateway **Iugu** (parcelas, juros).

## Fluxo de pedido (resumo)
```
Checkout → cria orders + order_items (status pending)
        → create-payment (PIX ou Iugu)
        → cliente paga
        → iugu-webhook / check-payment-status → payment_status = paid
        → PedidoConfirmado
```
Status possíveis em [[Supabase - Banco de Dados#Enums]].
