-- =============================================================
-- Frete fixo para entregas fora de Blumenau
-- =============================================================
-- Aplica DEPOIS de 20261119120000_mercado_pago_fixes.sql.
-- 1. orders.total passa a somar o frete (shipping_cost) aos itens.
--    Antes, o gatilho recalculava o total só com os itens e apagava o frete.
-- 2. A reserva do Mercado Pago grava o frete recebido da edge function
--    (R$ 25,00 fora de Blumenau; zero em Blumenau e na retirada).

begin;

create or replace function public.recalculate_order_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  real_total decimal(10,2);
begin
  select coalesce(sum(total_price), 0) into real_total
  from public.order_items
  where order_id = coalesce(new.order_id, old.order_id);

  update public.orders
  set subtotal   = real_total,
      total      = real_total + greatest(0, coalesce(shipping_cost, 0)),
      updated_at = now()
  where id = coalesce(new.order_id, old.order_id);

  return new;
end;
$$;

revoke execute on function public.recalculate_order_total() from public, anon, authenticated;

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
  -- Frete definido pela edge function (só service_role chama esta função).
  shipping numeric := least(greatest(coalesce((delivery->>'shipping_cost')::numeric, 0), 0), 1000);
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
  values (attempt, buyer, 'temp', total_cents / 100.0, total_cents / 100.0 + shipping, shipping,
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

revoke all on function public.reserve_mercado_pago_order(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_mercado_pago_order(uuid, uuid, jsonb) to service_role;

commit;
