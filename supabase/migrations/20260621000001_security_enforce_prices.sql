-- SECURITY: Enforce server-side prices on order_items
-- Prevents client-side price manipulation by overriding unit_price/total_price
-- with the actual product price from the products table.

CREATE OR REPLACE FUNCTION public.enforce_order_item_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actual_price DECIMAL(10,2);
BEGIN
  SELECT price INTO actual_price
  FROM public.products
  WHERE id = NEW.product_id AND is_active = true;

  IF actual_price IS NULL THEN
    RAISE EXCEPTION 'Product not found or inactive: %', NEW.product_id;
  END IF;

  -- Override whatever the client sent with the real price
  NEW.unit_price  := actual_price;
  NEW.total_price := actual_price * NEW.quantity;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_order_item_prices_trigger
BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_item_prices();

-- SECURITY: After inserting order items, recalculate orders.total from actual item prices.
-- Prevents the client-supplied subtotal/total from being used as the authoritative value.

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
  SET subtotal = real_total,
      total    = real_total,
      updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER recalculate_order_total_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_order_total();
