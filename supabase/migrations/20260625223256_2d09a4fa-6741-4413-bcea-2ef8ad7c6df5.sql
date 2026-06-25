
-- 1) products: hide cost_price & supplier_id from anon
REVOKE SELECT (cost_price, supplier_id) ON public.products FROM anon;

-- 2) tickets_suporte: scoped policies
DROP POLICY IF EXISTS "Authenticated users can select tickets" ON public.tickets_suporte;
DROP POLICY IF EXISTS "Authenticated users can update tickets" ON public.tickets_suporte;
DROP POLICY IF EXISTS "Authenticated users can delete tickets" ON public.tickets_suporte;
DROP POLICY IF EXISTS "Authenticated users can insert tickets" ON public.tickets_suporte;

CREATE POLICY "Users view own tickets" ON public.tickets_suporte
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own tickets" ON public.tickets_suporte
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users update own tickets, admin all" ON public.tickets_suporte
  FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete tickets" ON public.tickets_suporte
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) suporte_mensagens: scoped via ticket ownership
DROP POLICY IF EXISTS "Authenticated users can select messages" ON public.suporte_mensagens;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON public.suporte_mensagens;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.suporte_mensagens;

CREATE POLICY "Users view own ticket messages" ON public.suporte_mensagens
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tickets_suporte t
            WHERE t.id = suporte_mensagens.ticket_id
              AND (t.usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

CREATE POLICY "Users insert messages on own tickets" ON public.suporte_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tickets_suporte t
            WHERE t.id = suporte_mensagens.ticket_id
              AND (t.usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

CREATE POLICY "Users update own ticket messages" ON public.suporte_mensagens
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tickets_suporte t
            WHERE t.id = suporte_mensagens.ticket_id
              AND (t.usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

-- 4) orders: exclude guest (null user_id) rows from user SELECT policy
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT
  USING (user_id IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
CREATE POLICY "Users can create own orders" ON public.orders
  FOR INSERT
  WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id);

-- 5) storage: product-images — remove broad authenticated policies, add admin-only
DROP POLICY IF EXISTS "Allow authenticated upload to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read product-images" ON storage.objects;

CREATE POLICY "Public read product-images files" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images' AND name IS NOT NULL AND position('/' in name) > 0);

CREATE POLICY "Admins manage product-images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

-- 6) storage: suporte-anexos — require auth on upload, restrict read
DROP POLICY IF EXISTS "Allow public uploads to suporte-anexos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public viewing of suporte-anexos" ON storage.objects;

CREATE POLICY "Authenticated upload suporte-anexos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'suporte-anexos');

CREATE POLICY "Authenticated read suporte-anexos files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'suporte-anexos' AND name IS NOT NULL AND position('/' in name) > 0);

-- 7) SECURITY DEFINER trigger functions: revoke public execute
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_user_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_receivable_from_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_receivable_on_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_stock_on_order() FROM PUBLIC, anon, authenticated;

-- has_role: must remain callable by authenticated (used in RLS); revoke from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
