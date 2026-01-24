-- Drop and recreate the admin insert policies with proper role targeting
DROP POLICY IF EXISTS "Admins can create orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can create order items" ON public.order_items;

-- Recreate policies targeting authenticated users
CREATE POLICY "Admins can create orders" 
ON public.orders 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create order items" 
ON public.order_items 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));