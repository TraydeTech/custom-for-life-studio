-- =============================================================
-- SECURITY HARDENING — RLS, STORAGE, ADMIN POLICIES
-- =============================================================

-- ─── 1. TICKETS_SUPORTE: isolar por usuário ────────────────────────────────
-- Antes: qualquer autenticado via SELECT/UPDATE/DELETE em TODOS os tickets
DROP POLICY IF EXISTS "Authenticated users can select tickets"  ON public.tickets_suporte;
DROP POLICY IF EXISTS "Authenticated users can insert tickets"  ON public.tickets_suporte;
DROP POLICY IF EXISTS "Authenticated users can update tickets"  ON public.tickets_suporte;
DROP POLICY IF EXISTS "Authenticated users can delete tickets"  ON public.tickets_suporte;

-- Usuário vê só os próprios; admin vê todos
CREATE POLICY "tickets_select"
  ON public.tickets_suporte FOR SELECT
  USING (
    auth.uid() = usuario_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- Usuário só cria ticket com seu próprio ID
CREATE POLICY "tickets_insert"
  ON public.tickets_suporte FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

-- Só admin atualiza tickets (status, resposta)
CREATE POLICY "tickets_update"
  ON public.tickets_suporte FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Só admin deleta tickets
CREATE POLICY "tickets_delete"
  ON public.tickets_suporte FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── 2. SUPORTE_MENSAGENS: isolar por ticket do usuário ────────────────────
DROP POLICY IF EXISTS "Authenticated users can select messages" ON public.suporte_mensagens;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.suporte_mensagens;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON public.suporte_mensagens;

CREATE POLICY "messages_select"
  ON public.suporte_mensagens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets_suporte t
      WHERE t.id = ticket_id
        AND (t.usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "messages_insert"
  ON public.suporte_mensagens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets_suporte t
      WHERE t.id = ticket_id
        AND (t.usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "messages_update"
  ON public.suporte_mensagens FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── 3. STORAGE: suporte-anexos — exigir autenticação para upload ──────────
DROP POLICY IF EXISTS "Allow public uploads to suporte-anexos" ON storage.objects;

CREATE POLICY "suporte_anexos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'suporte-anexos');

-- ─── 4. STORAGE: product-images — restringir update/delete a admins ────────
-- Admin faz upload de produto, usuário autenticado apenas em engraving-previews/
DROP POLICY IF EXISTS "Allow authenticated upload to product-images"   ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update product-images"       ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete product-images"       ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload product images"                ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images"                ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images"                ON storage.objects;

CREATE POLICY "product_images_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (storage.foldername(name))[1] = 'engraving-previews'
    )
  );

CREATE POLICY "product_images_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "product_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
  );

-- ─── 5. PROFILES: admin pode ver e editar todos os clientes ───────────────
-- Sem isso, o painel admin não consegue listar clientes
CREATE POLICY IF NOT EXISTS "admin_profiles_select"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY IF NOT EXISTS "admin_profiles_update"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── 6. ADDRESSES: admin pode ver todos os endereços ─────────────────────
CREATE POLICY IF NOT EXISTS "admin_addresses_select"
  ON public.addresses FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── 7. ORDERS: impedir que usuário atualize seu próprio pedido ───────────
-- Usuários podem criar pedidos mas NÃO devem poder atualizar status/total
-- (apenas admins e a Edge Function com service role devem fazer isso)
-- Verificar se a política "Users can update orders" existe e removê-la se houver
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders'
      AND policyname LIKE '%user%update%'
      AND NOT policyname LIKE '%admin%'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own orders" ON public.orders';
  END IF;
END $$;

-- ─── 8. ORDER_ITEMS: impedir que usuário atualize itens do pedido ──────────
-- A Edge Function usa service role para isso; usuário comum nunca precisa atualizar
-- Manter apenas INSERT (já coberto pelo trigger de preço)
-- Não adicionar UPDATE policy para usuários normais
