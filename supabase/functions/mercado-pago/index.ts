import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const api = "https://api.mercadopago.com/v1/orders";
const site = Deno.env.get("SITE_URL") || "https://www.customforlife.com.br";
const storefrontOrigins = new Set([new URL(site).origin, "https://www.customforlife.com.br", "https://customforlife.com.br"]);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const realOrder = /^ORD(?!TST)[A-Z0-9]+$/;

async function validateSignature(req: Request, id: string, secret: string) {
  const requestId = req.headers.get("x-request-id");
  const parts = new URLSearchParams(req.headers.get("x-signature")?.replaceAll(",", "&").replaceAll(" ", ""));
  const timestamp = parts.get("ts");
  const signature = parts.get("v1");
  if (!requestId || !timestamp || !/^\d+$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(signature.match(/../g)!, (pair) => parseInt(pair, 16));
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(`id:${id.toLowerCase()};request-id:${requestId};ts:${timestamp};`));
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Origin": origin && storefrontOrigins.has(origin) ? origin : new URL(site).origin,
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };
  const reply = (body: object, status = 200) => Response.json(body, { headers, status });
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "Método inválido." }, 405);

  const token = Deno.env.get("MERCADO_PAGO_PRODUCTION_ACCESS_TOKEN");
  const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!token || !secret) return reply({ error: "Pagamento online indisponível." }, 503);

  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const providerHeaders = { Authorization: `Bearer ${token}` };

  try {
    const query = new URL(req.url).searchParams;
    if (query.get("webhook") === "1") {
      const id = query.get("data.id");
      if (!id || !realOrder.test(id) || !await validateSignature(req, id, secret)) {
        return reply({ error: "Notificação inválida." }, 401);
      }
      const response = await fetch(`${api}/${id}`, { headers: providerHeaders, signal: AbortSignal.timeout(10000) });
      if (!response.ok) return reply({ error: "Falha na consulta da cobrança." }, 502);
      const order = await response.json();
      if (order.id !== id || order.currency !== "BRL" || !uuid.test(order.external_reference)) {
        return reply({ received: true });
      }

      if (order.status === "processed" && order.status_detail === "accredited") {
        const { error } = await db.rpc("confirm_mercado_pago_order", {
          local_id: order.external_reference,
          payment_id: id,
          paid_amount: order.total_paid_amount,
        });
        if (error) return reply({ error: "Falha na atualização." }, 503);
      }
      return reply({ received: true });
    }

    const mode = Deno.env.get("MERCADO_PAGO_PRODUCTION_ENABLED");
    if (mode !== "true" && mode !== "admin") {
      return reply({ error: "Pagamento online indisponível." }, 503);
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return reply({ error: "Entre na sua conta." }, 401);
    const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await auth.auth.getUser(authorization.slice(7));
    if (!user) return reply({ error: "Entre na sua conta." }, 401);

    if (mode === "admin") {
      const { data: isAdmin } = await db.rpc("has_role", { _role: "admin", _user_id: user.id });
      if (!isAdmin) return reply({ error: "Pagamento online indisponível." }, 403);
    }

    const body = await req.json();
    if (typeof body.attempt !== "string" || !uuid.test(body.attempt)) return reply({ error: "Pedido inválido." }, 400);
    const fields = ["name", "phone", "street", "number", "complement", "neighborhood", "zip_code", "delivery_method"] as const;
    const delivery = Object.fromEntries(fields.map((field) => [
      field, typeof body.delivery?.[field] === "string" ? body.delivery[field].trim().slice(0, 250) : "",
    ]));
    if (!delivery.name || !delivery.phone) return reply({ error: "Preencha seu nome e telefone." }, 400);

    if (delivery.delivery_method === "delivery") {
      const zip = delivery.zip_code.replace(/\D/g, "");
      if (!/^\d{8}$/.test(zip) || !delivery.street || !delivery.number || !delivery.neighborhood) {
        return reply({ error: "Confira o endereço de entrega." }, 400);
      }
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return reply({ error: "Não foi possível validar o CEP. Tente novamente." }, 502);
      const address = await response.json();
      if (address.localidade !== "Blumenau" || address.uf !== "SC") {
        return reply({ error: "Para entregas fora de Blumenau, finalize pelo WhatsApp." }, 400);
      }
      Object.assign(delivery, { city: "Blumenau", state: "SC", zip_code: zip, free_shipping: true });
    } else if (delivery.delivery_method !== "pickup") {
      return reply({ error: "Escolha a forma de entrega." }, 400);
    }

    const { data: order, error: orderError } = await db.rpc("reserve_mercado_pago_order", {
      buyer: user.id, attempt: body.attempt, delivery,
    });
    if (orderError || !order) return reply({ error: "Não foi possível reservar o pedido. Confira o carrinho e o estoque." }, 409);
    if (order.status !== "pending" || order.payment_status !== "pending") {
      return reply({ error: "Confira este pedido em Meus pedidos." }, 409);
    }

    const { data: payment, error: paymentError } = await db.from("mercado_pago_orders")
      .select("checkout_url").eq("order_id", order.id).single();
    if (paymentError) return reply({ error: "Não foi possível recuperar o pedido." }, 503);
    if (payment.checkout_url) return reply({ checkoutUrl: payment.checkout_url });

    const returnUrl = new URL("/meus-pedidos", site).href;
    const total = Number(order.total).toFixed(2);
    const response = await fetch(api, {
      method: "POST",
      headers: { ...providerHeaders, "Content-Type": "application/json", "X-Idempotency-Key": order.id },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        type: "online",
        processing_mode: "manual",
        external_reference: order.id,
        total_amount: total,
        description: `Pedido ${order.order_number}`,
        items: [{ title: `Pedido ${order.order_number}`, quantity: 1, unit_price: total }],
        config: { online: { success_url: returnUrl, failure_url: returnUrl, pending_url: returnUrl, auto_return: "all" } },
      }),
    });
    if (!response.ok) {
      console.error("Mercado Pago create order returned", response.status);
      return reply({ error: "Pagamento indisponível. Tente novamente." }, 502);
    }

    const created = await response.json();
    if (!realOrder.test(created.id) || created.currency !== "BRL" || created.external_reference !== order.id) {
      return reply({ error: "Credencial ou cobrança de produção inválida." }, 502);
    }
    const checkout = new URL(created.checkout_url);
    if (checkout.origin !== "https://www.mercadopago.com.br") return reply({ error: "Endereço de pagamento inválido." }, 502);

    const { error: updateError } = await db.from("mercado_pago_orders").update({
      provider_id: created.id, checkout_url: checkout.href,
    }).eq("order_id", order.id);
    if (updateError) return reply({ error: "Não foi possível salvar o pagamento. Tente novamente." }, 503);

    return reply({ checkoutUrl: checkout.href });
  } catch {
    return reply({ error: "Não foi possível concluir a operação." }, 503);
  }
});
