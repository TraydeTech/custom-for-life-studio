-- =============================================================
-- Correções do Checkout Pro (Mercado Pago)
-- =============================================================
-- Aplica DEPOIS de 20261118230000_mercado_pago_orders.sql (já rodada).
-- 1. Pedido pago entra na produção e no Financeiro (paid_at, pdv_status,
--    payment_method real, parcelas, financial_transactions).
-- 2. Reservas abandonadas devolvem o estoque (release_*).
-- 3. Estorno/chargeback marcam o pedido e a transação.
-- 4. A prévia da gravação vai para o item do pedido.
-- 5. O carrinho é limpo quando o pagamento é confirmado.
-- 6. confirm_* devolve o motivo quando não confirma (para log).

begin;

alter table public.orders
  add column if not exists paid_at      timestamptz,
  add column if not exists installments integer default 1,
  add column if not exists pdv_status   text;

alter table public.mercado_pago_orders
  add column if not exists released_at timestamptz;

alter table public.financial_transactions
  add column if not exists mercado_pago_order_id text;

create unique index if not exists financial_transactions_mercado_pago_order_id_key
  on public.financial_transactions (mercado_pago_order_id)
  where mercado_pago_order_id is not null;

-- ── Devolve o estoque de uma reserva não paga ─────────────────────────────
create or replace function public.release_mercado_pago_order(local_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  update mercado_pago_orders m set released_at = now()
    from orders o
    where m.order_id = local_id and o.id = m.order_id and m.released_at is null
      and o.status = 'pending' and o.payment_status = 'pending';
  if not found then return false; end if;

  update products p set stock = coalesce(p.stock, 0) + i.qty
    from (select product_id, sum(quantity) as qty from order_items
          where order_id = local_id group by product_id) i
    where p.id = i.product_id;

  update orders set status = 'cancelled', payment_status = 'failed', updated_at = now()
    where id = local_id;
  return true;
end;
$$;

-- Reservas pendentes há mais de 2 horas são liberadas.
create or replace function public.release_expired_mercado_pago_orders()
returns integer
language plpgsql
set search_path = public
as $$
declare
  rec record;
  total integer := 0;
begin
  for rec in
    select m.order_id from mercado_pago_orders m join orders o on o.id = m.order_id
    where m.released_at is null and o.status = 'pending' and o.payment_status = 'pending'
      and o.created_at < now() - interval '2 hours'
  loop
    if release_mercado_pago_order(rec.order_id) then total := total + 1; end if;
  end loop;
  return total;
end;
$$;

-- ── Reserva (mesma assinatura) + limpeza de reservas antigas + prévia ─────
create or replace function public.reserve_mercado_pago_order(
  buyer uuid, attempt uuid, delivery jsonb
)
returns public.orders
language plpgsql
set search_path = public
as $$
declare
  result public.orders;
  total_cents bigint;
  snapshot jsonb;
  old record;
begin
  perform pg_advisory_xact_lock(hashtextextended(buyer::text, 0));
  select o.* into result from orders o join mercado_pago_orders m on m.order_id = o.id
    where o.id = attempt and o.user_id = buyer;
  if found then return result; end if;

  -- Devolve o estoque de reservas vencidas e das tentativas anteriores
  -- deste comprador (ele mudou o carrinho ou recomeçou o checkout).
  perform release_expired_mercado_pago_orders();
  for old in
    select m.order_id from mercado_pago_orders m join orders o on o.id = m.order_id
    where o.user_id = buyer and m.released_at is null
      and o.status = 'pending' and o.payment_status = 'pending'
  loop
    perform release_mercado_pago_order(old.order_id);
  end loop;

  perform id from cart_items where user_id = buyer order by id for update;
  perform p.id from products p
    where p.id in (select product_id from cart_items where user_id = buyer)
    order by p.id for update;

  if exists (
    select 1 from cart_items c join products p on p.id = c.product_id
    where c.user_id = buyer
    group by p.id
    having not coalesce(p.is_active, false)
      or p.price <= 0 or min(c.quantity) <= 0
      or sum(c.quantity) > coalesce(p.stock, 0)
      or sum(c.quantity) < coalesce(p.min_quantity, 1)
  ) then
    raise exception 'Revise o estoque e as quantidades do carrinho.';
  end if;

  select sum(round(p.price * 100)::bigint * c.quantity),
    jsonb_agg(jsonb_build_object(
      'product_id', p.id, 'product_name', p.name, 'product_image', p.images[1],
      'quantity', c.quantity, 'unit_price', round(p.price, 2),
      'customization_notes', c.customization_notes, 'engraving_text', c.engraving_text,
      'engraving_position_x', c.engraving_position_x, 'engraving_position_y', c.engraving_position_y,
      'engraving_file_url', c.engraving_file_url, 'product_color', c.product_color,
      'engraving_preview', c.engraving_preview_image
    ))
    into total_cents, snapshot
    from cart_items c join products p on p.id = c.product_id where c.user_id = buyer;

  if total_cents is null or total_cents <= 0 then
    raise exception 'O carrinho está vazio.';
  end if;

  insert into orders (id, user_id, order_number, subtotal, total, shipping_cost,
    shipping_address, source, status, payment_status, payment_method, pdv_status)
  values (attempt, buyer, 'temp', total_cents / 100.0, total_cents / 100.0, 0,
    delivery, 'site', 'pending', 'pending', 'mercado_pago', 'aguardando_pagamento')
  returning * into result;

  insert into mercado_pago_orders (order_id) values (result.id);
  -- A prévia chega como data URL; a edge function sobe para o Storage
  -- e troca pelo link público logo depois da reserva.
  insert into order_items (order_id, product_id, product_name, product_image, quantity,
    unit_price, total_price, customization_notes, engraving_text, engraving_position_x,
    engraving_position_y, engraving_file_url, product_color, engraving_preview_url)
  select result.id, item.product_id, item.product_name, item.product_image, item.quantity,
    item.unit_price, item.unit_price * item.quantity, item.customization_notes, item.engraving_text,
    item.engraving_position_x, item.engraving_position_y, item.engraving_file_url, item.product_color,
    item.engraving_preview
  from jsonb_to_recordset(snapshot) as item(
    product_id uuid, product_name text, product_image text, quantity integer, unit_price numeric,
    customization_notes text, engraving_text text, engraving_position_x numeric,
    engraving_position_y numeric, engraving_file_url text, product_color text, engraving_preview text
  );
  return result;
end;
$$;

-- ── Confirmação: produção, Financeiro, carrinho ───────────────────────────
drop function if exists public.confirm_mercado_pago_order(uuid, text, numeric);

create function public.confirm_mercado_pago_order(
  local_id uuid, payment_id text, paid_amount numeric,
  method text default 'mercado_pago', n_installments integer default 1
)
returns text
language plpgsql
set search_path = public
as $$
declare
  m mercado_pago_orders;
  o orders;
  n integer := greatest(1, coalesce(n_installments, 1));
  gross numeric := round(paid_amount, 2);
  fee numeric;
  -- Taxas ESTIMADAS para o Financeiro. Ajuste conforme o seu plano no Mercado Pago.
  fee_rate numeric := case method
    when 'pix' then 0.0099
    when 'debito' then 0.0199
    else 0.0498
  end;
begin
  select * into m from mercado_pago_orders where order_id = local_id for update;
  if not found then return 'not_found'; end if;
  if m.provider_id is distinct from payment_id then return 'provider_mismatch'; end if;

  select * into o from orders where id = local_id for update;
  if o.payment_status = 'paid' then return 'already_paid'; end if;
  if round(o.total, 2) <> gross then return 'amount_mismatch'; end if;
  if o.payment_status not in ('pending', 'failed') then return 'invalid_state'; end if;

  -- Reserva já liberada (cliente pagou depois do prazo): retoma o estoque.
  if m.released_at is not null then
    update products p set stock = greatest(0, coalesce(p.stock, 0) - i.qty)
      from (select product_id, sum(quantity) as qty from order_items
            where order_id = local_id group by product_id) i
      where p.id = i.product_id;
    update mercado_pago_orders set released_at = null where order_id = local_id;
  end if;

  update orders set
    status = 'paid', payment_status = 'paid', payment_method = method,
    installments = n, paid_at = now(), pdv_status = 'em_producao', updated_at = now()
  where id = local_id;

  fee := round(gross * fee_rate, 2);
  insert into financial_transactions (order_id, payment_method, gross_amount, gateway_fee,
    net_amount, installments, status, mercado_pago_order_id)
  values (local_id, method, gross, fee, gross - fee, n, 'confirmed', payment_id)
  on conflict do nothing;

  -- Limpa do carrinho os produtos que foram pagos.
  delete from cart_items
    where user_id = o.user_id
      and product_id in (select product_id from order_items where order_id = local_id);

  return 'confirmed';
end;
$$;

-- ── Estorno / chargeback ──────────────────────────────────────────────────
create or replace function public.refund_mercado_pago_order(local_id uuid, payment_id text)
returns text
language plpgsql
set search_path = public
as $$
begin
  update orders o set payment_status = 'refunded', status = 'cancelled', updated_at = now()
    from mercado_pago_orders m
    where o.id = local_id and m.order_id = o.id and m.provider_id = payment_id
      and o.payment_status = 'paid';
  if not found then return 'ignored'; end if;
  update financial_transactions set status = 'refunded' where mercado_pago_order_id = payment_id;
  return 'refunded';
end;
$$;

revoke all on function public.release_mercado_pago_order(uuid) from public, anon, authenticated;
revoke all on function public.release_expired_mercado_pago_orders() from public, anon, authenticated;
revoke all on function public.reserve_mercado_pago_order(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.confirm_mercado_pago_order(uuid, text, numeric, text, integer) from public, anon, authenticated;
revoke all on function public.refund_mercado_pago_order(uuid, text) from public, anon, authenticated;
grant execute on function public.release_mercado_pago_order(uuid) to service_role;
grant execute on function public.release_expired_mercado_pago_orders() to service_role;
grant execute on function public.reserve_mercado_pago_order(uuid, uuid, jsonb) to service_role;
grant execute on function public.confirm_mercado_pago_order(uuid, text, numeric, text, integer) to service_role;
grant execute on function public.refund_mercado_pago_order(uuid, text) to service_role;

commit;
