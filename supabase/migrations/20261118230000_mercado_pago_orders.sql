begin;

-- Checkout snapshots are only created by the payment function after authentication.
create table public.mercado_pago_orders (
  order_id uuid primary key references public.orders(id),
  provider_id text unique,
  checkout_url text,
  created_at timestamptz not null default now()
);

alter table public.mercado_pago_orders enable row level security;
revoke all on public.mercado_pago_orders from anon, authenticated;
grant select, insert, update on public.mercado_pago_orders to service_role;

create function public.reserve_mercado_pago_order(
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
begin
  perform pg_advisory_xact_lock(hashtextextended(buyer::text, 0));
  select o.* into result from orders o join mercado_pago_orders m on m.order_id = o.id
    where o.id = attempt and o.user_id = buyer;
  if found then return result; end if;

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
      'engraving_file_url', c.engraving_file_url, 'product_color', c.product_color
    ))
    into total_cents, snapshot
    from cart_items c join products p on p.id = c.product_id where c.user_id = buyer;

  if total_cents is null or total_cents <= 0 then
    raise exception 'O carrinho está vazio.';
  end if;

  insert into orders (id, user_id, order_number, subtotal, total, shipping_cost,
    shipping_address, source, status, payment_status, payment_method)
  values (attempt, buyer, 'temp', total_cents / 100.0, total_cents / 100.0, 0,
    delivery, 'site', 'pending', 'pending', 'mercado_pago')
  returning * into result;

  insert into mercado_pago_orders (order_id) values (result.id);
  insert into order_items (order_id, product_id, product_name, product_image, quantity,
    unit_price, total_price, customization_notes, engraving_text, engraving_position_x,
    engraving_position_y, engraving_file_url, product_color)
  select result.id, item.product_id, item.product_name, item.product_image, item.quantity,
    item.unit_price, item.unit_price * item.quantity, item.customization_notes, item.engraving_text,
    item.engraving_position_x, item.engraving_position_y, item.engraving_file_url, item.product_color
  from jsonb_to_recordset(snapshot) as item(
    product_id uuid, product_name text, product_image text, quantity integer, unit_price numeric,
    customization_notes text, engraving_text text, engraving_position_x numeric,
    engraving_position_y numeric, engraving_file_url text, product_color text
  );
  return result;
end;
$$;

revoke all on function public.reserve_mercado_pago_order(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_mercado_pago_order(uuid, uuid, jsonb) to service_role;

create function public.confirm_mercado_pago_order(
  local_id uuid, payment_id text, paid_amount numeric
)
returns void
language sql
set search_path = public
as $$
  update orders o set status = 'paid', payment_status = 'paid'
  from mercado_pago_orders m
  where o.id = local_id and m.order_id = o.id and m.provider_id = payment_id
    and o.total = paid_amount and o.status = 'pending' and o.payment_status = 'pending';
$$;

revoke all on function public.confirm_mercado_pago_order(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.confirm_mercado_pago_order(uuid, text, numeric) to service_role;

commit;
