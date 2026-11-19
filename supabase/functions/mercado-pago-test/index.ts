import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ordersUrl = "https://api.mercadopago.com/v1/orders";
const testOrderId = /^ORDTST[A-Z0-9]+$/;

Deno.serve(async (request) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };
  const reply = (body: object, status = 200) => Response.json(body, { headers, status });

  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return reply({ error: "Método inválido." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return reply({ error: "Entre na sua conta." }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user } } = await supabase.auth.getUser(authorization.slice(7));
    if (!user) return reply({ error: "Entre na sua conta." }, 401);

    const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin", _user_id: user.id });
    if (!isAdmin) return reply({ error: "Teste disponível apenas para administradores." }, 403);

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) return reply({ error: "Credencial do Mercado Pago indisponível." }, 503);

    const body = await request.json();
    const externalReference = `test-${user.id}`;
    const paymentHeaders = { Authorization: `Bearer ${accessToken}` };

    if (body.action === "status") {
      if (typeof body.id !== "string" || !testOrderId.test(body.id)) {
        return reply({ error: "Identificador de teste inválido." }, 400);
      }
      const response = await fetch(`${ordersUrl}/${body.id}`, { headers: paymentHeaders });
      if (!response.ok) return reply({ error: "Não foi possível consultar o teste." }, 502);
      const order = await response.json();
      if (order.id !== body.id || order.external_reference !== externalReference || order.currency !== "BRL") {
        return reply({ error: "Teste não encontrado." }, 404);
      }
      return reply({ status: order.status, detail: order.status_detail });
    }

    if (body.action !== "create" || typeof body.attempt !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(body.attempt)) {
      return reply({ error: "Solicitação inválida." }, 400);
    }

    const { data: cart, error } = await supabase
      .from("cart_items")
      .select("quantity, products(name, price, is_active)")
      .eq("user_id", user.id);
    if (error || !cart?.length) return reply({ error: "Adicione um produto ao carrinho." }, 400);

    const items = [];
    let total = 0;
    for (const row of cart) {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      const cents = Math.round(Number(product?.price) * 100);
      if (!product?.is_active || !Number.isSafeInteger(cents) || cents <= 0 ||
        !Number.isSafeInteger(row.quantity) || row.quantity <= 0) {
        return reply({ error: "Revise os produtos do carrinho." }, 400);
      }
      items.push({ title: product.name, unit_price: (cents / 100).toFixed(2), quantity: row.quantity });
      total += cents * row.quantity;
    }
    if (!Number.isSafeInteger(total)) return reply({ error: "Valor inválido." }, 400);

    const site = Deno.env.get("SITE_URL") || "https://www.customforlife.com.br";
    const returnUrl = new URL("/carrinho?mercado-pago-teste=retorno", site).href;
    const response = await fetch(ordersUrl, {
      method: "POST",
      headers: { ...paymentHeaders, "Content-Type": "application/json", "X-Idempotency-Key": body.attempt },
      body: JSON.stringify({
        type: "online",
        processing_mode: "manual",
        total_amount: (total / 100).toFixed(2),
        external_reference: externalReference,
        items,
        config: { online: { success_url: returnUrl, failure_url: returnUrl, pending_url: returnUrl, auto_return: "all" } },
      }),
    });
    if (!response.ok) {
      console.error("Mercado Pago rejected test order", response.status);
      return reply({ error: "O Mercado Pago não aceitou o teste. Verifique as credenciais de teste." }, 502);
    }

    const order = await response.json();
    if (!testOrderId.test(order.id)) {
      return reply({ error: "Use o Access Token do ambiente de teste do Mercado Pago." }, 409);
    }
    const checkout = new URL(order.checkout_url);
    if (checkout.origin !== "https://www.mercadopago.com.br") {
      return reply({ error: "Endereço de checkout inesperado." }, 502);
    }
    return reply({ id: order.id, checkoutUrl: checkout.href });
  } catch {
    return reply({ error: "Não foi possível processar o teste." }, 500);
  }
});
