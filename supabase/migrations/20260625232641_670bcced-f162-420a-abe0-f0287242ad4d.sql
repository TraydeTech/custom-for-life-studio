
-- 1. Products: revoke sensitive columns from anon
REVOKE SELECT (cost_price, supplier_id) ON public.products FROM anon;

-- 2. tickets_suporte: split UPDATE so users only modify descricao
DROP POLICY IF EXISTS "Users update own tickets, admin all" ON public.tickets_suporte;
CREATE POLICY "Admins update tickets"
  ON public.tickets_suporte FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Restrict column-level UPDATE for non-admin authenticated users
REVOKE UPDATE ON public.tickets_suporte FROM authenticated;
GRANT UPDATE (descricao, updated_at) ON public.tickets_suporte TO authenticated;
GRANT UPDATE ON public.tickets_suporte TO service_role;
CREATE POLICY "Users update own ticket description"
  ON public.tickets_suporte FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- 3. Storage: engravings - scope insert to own folder
DROP POLICY IF EXISTS "Authenticated users can upload engravings" ON storage.objects;
CREATE POLICY "engravings_upload_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'engravings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Storage: suporte-anexos - scope read to ticket owner/admin
DROP POLICY IF EXISTS "Authenticated read suporte-anexos files" ON storage.objects;
CREATE POLICY "suporte_anexos_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'suporte-anexos'
    AND EXISTS (
      SELECT 1 FROM public.tickets_suporte t
      WHERE (storage.foldername(name))[1] = t.id::text
        AND (t.usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- 5. Storage: suporte-anexos - scope upload to ticket owner/admin
DROP POLICY IF EXISTS "Authenticated upload suporte-anexos" ON storage.objects;
CREATE POLICY "suporte_anexos_upload_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'suporte-anexos'
    AND EXISTS (
      SELECT 1 FROM public.tickets_suporte t
      WHERE (storage.foldername(name))[1] = t.id::text
        AND (t.usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- 6. Prevent listing of public buckets by requiring a path
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Engravings are publicly accessible" ON storage.objects;
CREATE POLICY "Public read engravings files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'engravings'
    AND name IS NOT NULL
    AND POSITION('/' IN name) > 0
  );
