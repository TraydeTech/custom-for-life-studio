-- Create function to update stock when order items are created
CREATE OR REPLACE FUNCTION public.update_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Decrease stock for the product
    UPDATE public.products
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$;

-- Create trigger that fires when order items are inserted
DROP TRIGGER IF EXISTS trigger_update_stock_on_order ON public.order_items;
CREATE TRIGGER trigger_update_stock_on_order
    AFTER INSERT ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_stock_on_order();