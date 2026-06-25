-- =============================================================
-- Cria financial_transactions (estava faltando no banco)
-- =============================================================
-- As edge functions (create-payment, iugu-webhook, check-payment-status)
-- gravam aqui e o painel admin/Financeiro lê daqui. A tabela nunca foi
-- criada, então os inserts falhavam em silêncio e o painel ficava vazio.
--
-- Colunas conforme o uso real no código. RLS: só admin lê/gerencia; as
-- edge functions usam service_role (ignora RLS). Idempotência por invoice.

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_method   TEXT,
  status           TEXT NOT NULL DEFAULT 'confirmed',
  gross_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  gateway_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  installments     INTEGER DEFAULT 1,
  iugu_invoice_id  TEXT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotência: webhook/check não duplicam transação da mesma invoice
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_iugu_invoice_id_key
  ON public.financial_transactions (iugu_invoice_id)
  WHERE iugu_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_order_id
  ON public.financial_transactions (order_id);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage financial_transactions" ON public.financial_transactions;
CREATE POLICY "Admins can manage financial_transactions"
  ON public.financial_transactions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
