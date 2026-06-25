-- =============================================================
-- SEGURANÇA: forçar preços no servidor (anti-adulteração)
-- =============================================================
-- A política de INSERT em order_items só valida o DONO do pedido, não o
-- PREÇO. Sem isto, um cliente pode forjar unit_price/total_price via API e
-- o create-payment cobraria o valor adulterado no Iugu.
--
-- Estes gatilhos sobrescrevem o que o cliente enviar com o preço REAL da
-- tabela products e recalculam orders.total a partir dos itens.
--
-- Idempotente: pode ser reaplicado sem erro (DROP TRIGGER IF EXISTS antes).

-- ── 1. order_items: sobrescreve preço com o valor real do produto ──────────
CREATE OR REPLACE FUNCTION public.enforce_order_item_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actual_price DECIMAL(10,2);
BEGIN
  -- Sem filtro de is_active: o admin (PDV) pode vender item desativado;
  -- o objetivo aqui é apenas travar o PREÇO, não a disponibilidade.
  SELECT price INTO actual_price
  FROM public.products
  WHERE id = NEW.product_id;

  IF actual_price IS NULL THEN
    RAISE EXCEPTION 'Produto inexistente: %', NEW.product_id;
  END IF;

  NEW.unit_price  := actual_price;
  NEW.total_price := actual_price * NEW.quantity;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_order_item_prices_trigger ON public.order_items;
CREATE TRIGGER enforce_order_item_prices_trigger
BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_item_prices();

-- ── 2. orders.total: recalcula a partir dos itens reais ────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  real_total DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(total_price), 0)
  INTO real_total
  FROM public.order_items
  WHERE order_id = COALESCE(NEW.order_id, OLD.order_id);

  UPDATE public.orders
  SET subtotal   = real_total,
      total      = real_total,
      updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recalculate_order_total_trigger ON public.order_items;
CREATE TRIGGER recalculate_order_total_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_order_total();

-- ── 3. Funções definer não precisam de EXECUTE público ─────────────────────
REVOKE EXECUTE ON FUNCTION public.enforce_order_item_prices() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_order_total()   FROM PUBLIC, anon, authenticated;
