
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' OR NEW.order_number = 'temp' OR NEW.order_number LIKE 'temp%' THEN
        NEW.order_number := 'CFL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_order_number ON public.orders;
CREATE TRIGGER set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_number();

-- Fix existing orders with temporary numbers
UPDATE public.orders
SET order_number = 'CFL-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')
WHERE order_number = 'temp' OR order_number LIKE 'temp%' OR order_number IS NULL OR order_number = '';
