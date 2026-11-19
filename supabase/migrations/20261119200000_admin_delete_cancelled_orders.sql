-- =============================================================
-- Admin pode excluir pedidos CANCELADOS
-- =============================================================
-- Antes não existia política de DELETE em orders: o Supabase não dava erro,
-- só apagava 0 linhas, e o painel mostrava "excluído" sem excluir nada.
--
-- 1. Política: só administradores, e só pedidos com status 'cancelled'
--    (pedidos pagos/pendentes não podem ser apagados por engano).
-- 2. mercado_pago_orders passa a ser apagada junto com o pedido
--    (antes a chave estrangeira bloqueava a exclusão de pedidos do site).
--    order_items já era ON DELETE CASCADE; financial_transactions fica com
--    order_id = NULL (o histórico financeiro é preservado).

begin;

drop policy if exists "Admins can delete cancelled orders" on public.orders;
create policy "Admins can delete cancelled orders"
  on public.orders for delete
  using (public.has_role(auth.uid(), 'admin') and status = 'cancelled');

alter table public.mercado_pago_orders
  drop constraint if exists mercado_pago_orders_order_id_fkey;
alter table public.mercado_pago_orders
  add constraint mercado_pago_orders_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete cascade;

commit;
