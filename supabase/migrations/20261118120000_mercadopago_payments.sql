-- =============================================================
-- Mercado Pago: colunas usadas pelas edge functions de pagamento
-- =============================================================
-- create-payment / check-payment-status / mercadopago-webhook gravam o id
-- do pagamento do MP e os dados de confirmação. IF NOT EXISTS: algumas
-- colunas (paid_at, pdv_status, installments) podem já existir no banco
-- de produção sem migration correspondente.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS installments  INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pdv_status    TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_mp_payment_id
  ON public.orders (mp_payment_id);

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;

-- Idempotência: webhook e polling não duplicam a transação do mesmo pagamento
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_mp_payment_id_key
  ON public.financial_transactions (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;
