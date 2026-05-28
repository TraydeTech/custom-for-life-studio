-- Adiciona coluna para URL do comprovante PIX enviado pelo cliente
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;

-- Adiciona coluna para método de entrega escolhido pelo cliente
-- 'pickup' = Retirada no local (grátis)
-- 'blumenau' = Entrega em Blumenau (R$20)
-- 'other' = Fora de Blumenau (frete a combinar)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'blumenau';
