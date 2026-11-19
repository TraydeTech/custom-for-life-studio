import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const api = "https://api.mercadopago.com/v1/orders";
const site = Deno.env.get("SITE_URL") || "https://www.customforlife.com.br";
const storefrontOrigins = new Set([new URL(site).origin, "https://www.customforlife.com.br", "https://customforlife.com.br"]);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const anyOrder = /^ORD[A-Z0-9]+$/;
const realOrder = /^ORD(?!TST)[A-Z0-9]+$/;
const paymentsApi = "https://api.mercadopago.com/v1/payments";
// Frete fixo para entregas fora de Blumenau (manter igual a FIXED_SHIPPING em src/lib/store-config.ts).
const FIXED_SHIPPING = 25;
const paymentId = /^\d{1,20}$/;

// ── Checkout Transparente (/v1/payments) ──────────────────────────────────
function paymentMethodOf(payment: any): string {
  const type = String(payment?.payment_type_id ?? "");
  if (type === "credit_card") return "credito";
  if (type === "debit_card") return "debito";
  if (type === "bank_transfer" || payment?.payment_method_id === "pix") return "pix";
  return "mercado_pago";
}

function rejectionMessage(detail: string): string {
  const map: Record<string, string> = {
    cc_rejected_bad_filled_card_number: "Número do cartão inválido.",
    cc_rejected_bad_filled_date: "Data de validade inválida.",
    cc_rejected_bad_filled_security_code: "Código de segurança (CVV) inválido.",
    cc_rejected_bad_filled_other: "Confira os dados do cartão.",
    cc_rejected_insufficient_amount: "Limite insuficiente no cartão.",
    cc_rejected_call_for_authorize: "Autorize o pagamento com o banco do cartão e tente de novo.",
    cc_rejected_card_disabled: "Cartão desabilitado. Fale com o banco emissor.",
    cc_rejected_duplicated_payment: "Pagamento duplicado. Aguarde alguns minutos.",
    cc_rejected_high_risk: "Pagamento recusado por segurança. Tente outro cartão ou Pix.",
    cc_rejected_max_attempts: "Limite de tentativas atingido. Tente outro cartão ou Pix.",
  };
  return map[detail] || "Pagamento recusado. Confira os dados ou tente outro cartão ou Pix.";
}

// Aplica no banco o estado de um pagamento buscado na API do Mercado Pago.
async function applyPayment(db: any, payment: any): Promise<{ paid: boolean; result: string }> {
  const localId = payment.external_reference;
  const id = String(payment.id);
  const status = String(payment.status ?? "");

  if (status === "approved") {
    // O pagamento aprovado é a referência do pedido (cobre Pix antigo pago depois de outra tentativa).
    await db.from("mercado_pago_orders").update({ provider_id: id }).eq("order_id", localId);
    const { data, error } = await db.rpc("confirm_mercado_pago_order", {
      local_id: localId, payment_id: id, paid_amount: payment.transaction_amount,
      method: paymentMethodOf(payment), n_installments: payment.installments || 1,
    });
    if (error) throw new Error(`confirm failed: ${error.message}`);
    if (data !== "confirmed" && data !== "already_paid") {
      console.error("Mercado Pago payment not confirmed", id, data, payment.transaction_amount);
    }
    return { paid: data === "confirmed" || data === "already_paid", result: String(data) };
  }

  if (status === "refunded" || status === "charged_back") {
    const { data, error } = await db.rpc("refund_mercado_pago_order", { local_id: localId, payment_id: id });
    if (error) throw new Error(`refund failed: ${error.message}`);
    return { paid: false, result: String(data) };
  }

  // Pix expirado: libera a reserva, só se for a tentativa atual do pedido.
  if (status === "cancelled") {
    const { data: link } = await db.from("mercado_pago_orders").select("provider_id").eq("order_id", localId).maybeSingle();
    if (link?.provider_id === id) {
      const { error } = await db.rpc("release_mercado_pago_order", { local_id: localId });
      if (error) throw new Error(`release failed: ${error.message}`);
    }
    return { paid: false, result: "cancelled" };
  }

  // rejected: o pedido continua reservado para o cliente tentar de novo.
  return { paid: false, result: status || "pending" };
}

// Converte o meio de pagamento do Mercado Pago no padrão do painel (pix | credito | debito).
// Campos lidos de forma defensiva: confira o formato em um pagamento de teste.
function paymentInfo(order: any): { method: string; installments: number } {
  const payment = order?.transactions?.payments?.[0] ?? {};
  const type = String(payment.payment_method?.type ?? payment.payment_type_id ?? "");
  const id = String(payment.payment_method?.id ?? "");
  const method = type === "credit_card" ? "credito"
    : type === "debit_card" ? "debito"
    : (type === "bank_transfer" || id === "pix") ? "pix"
    : "mercado_pago";
  const installments = Number(payment.payment_method?.installments ?? payment.installments ?? 1) || 1;
  return { method, installments };
}

// Aplica no banco o estado de uma order buscada na API do Mercado Pago.
async function applyOrder(db: any, order: any): Promise<{ paid: boolean; result: string }> {
  const status = String(order.status ?? "");
  const detail = String(order.status_detail ?? "");
  const localId = order.external_reference;

  if (status === "processed" && detail === "accredited") {
    const { method, installments } = paymentInfo(order);
    const { data, error } = await db.rpc("confirm_mercado_pago_order", {
      local_id: localId, payment_id: order.id, paid_amount: order.total_paid_amount,
      method, n_installments: installments,
    });
    if (error) throw new Error(`confirm failed: ${error.message}`);
    if (data !== "confirmed" && data !== "already_paid") {
      console.error("Mercado Pago order not confirmed", order.id, data, order.total_paid_amount);
    }
    return { paid: data === "confirmed" || data === "already_paid", result: String(data) };
  }

  if (["refunded", "charged_back"].includes(status) || ["refunded", "charged_back", "chargeback"].includes(detail)) {
    const { data, error } = await db.rpc("refund_mercado_pago_order", { local_id: localId, payment_id: order.id });
    if (error) throw new Error(`refund failed: ${error.message}`);
    return { paid: false, result: String(data) };
  }

  if (["cancelled", "canceled", "expired", "failed"].includes(status)) {
    const { error } = await db.rpc("release_mercado_pago_order", { local_id: localId });
    if (error) throw new Error(`release failed: ${error.message}`);
    return { paid: false, result: status };
  }

  return { paid: false, result: status || "pending" };
}

// Sobe a prévia da gravação (data URL) para o Storage e grava o link no item.
async function uploadPreviews(db: any, userId: string, orderId: string) {
  const { data: items } = await db.from("order_items")
    .select("id, engraving_preview_url").eq("order_id", orderId).like("engraving_preview_url", "data:%");
  for (const item of items ?? []) {
    try {
      const [meta, base64] = String(item.engraving_preview_url).split(",");
      const contentType = meta.match(/^data:([^;]+)/)?.[1] || "image/png";
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const path = `${userId}/${orderId}/${item.id}.png`;
      const { error } = await db.storage.from("engravings").upload(path, bytes, { contentType, upsert: true });
      if (error) throw error;
      const { data } = db.storage.from("engravings").getPublicUrl(path);
      await db.from("order_items").update({ engraving_preview_url: data.publicUrl }).eq("id", item.id);
    } catch (e) {
      console.error("engraving preview upload failed", item.id, e);
    }
  }
}

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
      const raw = query.get("data.id") || "";
      const id = raw.toUpperCase();
      // Assinatura primeiro, com qualquer ID: o 401 passa a significar só "assinatura inválida".
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(raw) || !await validateSignature(req, raw, secret)) {
        console.error("Mercado Pago webhook: invalid signature", raw);
        return reply({ error: "Notificação inválida." }, 401);
      }
      // Notificação de pagamento (Checkout Transparente).
      if (query.get("type") === "payment" && paymentId.test(raw)) {
        const response = await fetch(`${paymentsApi}/${raw}`, { headers: providerHeaders, signal: AbortSignal.timeout(10000) });
        if (response.status === 404) return reply({ received: true, ignored: "not_found" });
        if (!response.ok) return reply({ error: "Falha na consulta do pagamento." }, 502);
        const payment = await response.json();
        if (String(payment.id) !== raw || payment.currency_id !== "BRL" || !uuid.test(payment.external_reference ?? "")) {
          return reply({ received: true });
        }
        try {
          await applyPayment(db, payment);
        } catch (e) {
          console.error("Mercado Pago payment webhook update failed", raw, e);
          return reply({ error: "Falha na atualização." }, 503);
        }
        return reply({ received: true });
      }

      // Assinatura OK. IDs que não são orders de produção (simulador "123456",
      // orders de teste ORDTST...) são ignorados com 200.
      if (!anyOrder.test(id) || !realOrder.test(id)) {
        console.log("Mercado Pago webhook: signature ok, ignored id", raw);
        return reply({ received: true, ignored: "not_a_production_order" });
      }

      const response = await fetch(`${api}/${id}`, { headers: providerHeaders, signal: AbortSignal.timeout(10000) });
      // 404: ID inexistente (ex.: simulador do painel). Responde 200 para não gerar reenvios.
      if (response.status === 404) return reply({ received: true, ignored: "not_found" });
      if (!response.ok) return reply({ error: "Falha na consulta da cobrança." }, 502);
      const order = await response.json();
      if (order.id !== id || order.currency !== "BRL" || !uuid.test(order.external_reference)) {
        return reply({ received: true });
      }

      try {
        await applyOrder(db, order);
      } catch (e) {
        console.error("Mercado Pago webhook update failed", id, e);
        return reply({ error: "Falha na atualização." }, 503);
      }
      return reply({ received: true });
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return reply({ error: "Entre na sua conta." }, 401);
    const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await auth.auth.getUser(authorization.slice(7));
    if (!user) return reply({ error: "Entre na sua conta." }, 401);

    const body = await req.json();

    // Consulta do resultado ao voltar do Mercado Pago (plano B do webhook).
    if (body.action === "status") {
      if (typeof body.order_id !== "string" || !uuid.test(body.order_id)) return reply({ error: "Pedido inválido." }, 400);
      const { data: local } = await db.from("orders")
        .select("id, payment_status, mercado_pago_orders(provider_id)")
        .eq("id", body.order_id).eq("user_id", user.id).maybeSingle();
      if (!local) return reply({ error: "Pedido não encontrado." }, 404);
      if (local.payment_status === "paid") return reply({ paid: true, status: "paid" });
      const link = Array.isArray(local.mercado_pago_orders) ? local.mercado_pago_orders[0] : local.mercado_pago_orders;
      if (!link?.provider_id) return reply({ paid: false, status: local.payment_status });
      if (paymentId.test(link.provider_id)) {
        const response = await fetch(`${paymentsApi}/${link.provider_id}`, { headers: providerHeaders, signal: AbortSignal.timeout(10000) });
        if (!response.ok) return reply({ paid: false, status: "unknown" });
        const payment = await response.json();
        if (String(payment.id) !== link.provider_id || payment.external_reference !== local.id) {
          return reply({ paid: false, status: "unknown" });
        }
        const { paid, result } = await applyPayment(db, payment);
        return reply({ paid, status: result });
      }
      const response = await fetch(`${api}/${link.provider_id}`, { headers: providerHeaders, signal: AbortSignal.timeout(10000) });
      if (!response.ok) return reply({ paid: false, status: "unknown" });
      const order = await response.json();
      if (order.id !== link.provider_id || order.external_reference !== local.id || order.currency !== "BRL") {
        return reply({ paid: false, status: "unknown" });
      }
      const { paid, result } = await applyOrder(db, order);
      return reply({ paid, status: result });
    }

    const mode = Deno.env.get("MERCADO_PAGO_PRODUCTION_ENABLED");
    if (mode !== "true" && mode !== "admin") {
      return reply({ error: "Pagamento online indisponível." }, 503);
    }

    if (mode === "admin") {
      const { data: isAdmin } = await db.rpc("has_role", { _role: "admin", _user_id: user.id });
      if (!isAdmin) return reply({ error: "Pagamento online indisponível." }, 403);
    }

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
      if (address.erro || !address.localidade || !address.uf) {
        return reply({ error: "CEP não encontrado. Confira o endereço de entrega." }, 400);
      }
      // Frete: grátis em Blumenau/SC, valor fixo para o resto do Brasil.
      const blumenau = address.localidade === "Blumenau" && address.uf === "SC";
      Object.assign(delivery, {
        city: address.localidade, state: address.uf, zip_code: zip,
        free_shipping: blumenau, shipping_cost: blumenau ? 0 : FIXED_SHIPPING,
      });
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

    await uploadPreviews(db, user.id, order.id);

    // Pagamento direto no site: cartão de crédito ou Pix (Payment Brick).
    if (body.action === "pay") {
      const selected = body.payment?.selectedPaymentMethod;
      const form = body.payment?.formData ?? {};
      const email = typeof form.payer?.email === "string" && form.payer.email ? form.payer.email : user.email;
      const doc = form.payer?.identification;
      const payload: Record<string, unknown> = {
        transaction_amount: Math.round(Number(order.total) * 100) / 100,
        description: `Pedido ${order.order_number} - Custom For Life`,
        external_reference: order.id,
        notification_url: `${url}/functions/v1/mercado-pago?webhook=1`,
        payer: {
          email,
          identification: doc?.type && doc?.number ? { type: String(doc.type), number: String(doc.number) } : undefined,
        },
        metadata: { order_id: order.id, order_number: order.order_number },
      };

      if (selected === "credit_card") {
        if (typeof form.token !== "string" || typeof form.payment_method_id !== "string") {
          return reply({ error: "Confira os dados do cartão." }, 400);
        }
        Object.assign(payload, {
          token: form.token,
          payment_method_id: form.payment_method_id,
          issuer_id: form.issuer_id ? String(form.issuer_id) : undefined,
          installments: Math.min(Math.max(1, Math.floor(Number(form.installments) || 1)), 12),
          statement_descriptor: "CUSTOMFORLIFE",
        });
      } else if (selected === "bank_transfer") {
        Object.assign(payload, {
          payment_method_id: "pix",
          date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString(),
        });
      } else {
        return reply({ error: "Escolha cartão de crédito ou Pix." }, 400);
      }

      const response = await fetch(paymentsApi, {
        method: "POST",
        headers: { ...providerHeaders, "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify(payload),
      });
      const payment = await response.json().catch(() => ({}));
      if (!response.ok || !payment?.id) {
        console.error("Mercado Pago create payment returned", response.status, payment?.message, payment?.cause);
        return reply({ error: "Não foi possível processar o pagamento. Confira os dados e tente novamente." }, 502);
      }

      await db.from("mercado_pago_orders").update({ provider_id: String(payment.id) }).eq("order_id", order.id);
      const base = { orderId: order.id, orderNumber: order.order_number };

      if (payment.status === "approved") {
        await applyPayment(db, payment);
        return reply({ ...base, status: "paid" });
      }
      if (selected === "bank_transfer") {
        const tx = payment.point_of_interaction?.transaction_data ?? {};
        return reply({ ...base, status: "pix", pixQrCode: tx.qr_code, pixQrCodeBase64: tx.qr_code_base64 });
      }
      if (payment.status === "in_process" || payment.status === "pending") {
        return reply({ ...base, status: "pending", message: "Pagamento em análise. Você recebe a confirmação em instantes." });
      }
      return reply({ error: rejectionMessage(String(payment.status_detail ?? "")) }, 402);
    }

    const { data: payment, error: paymentError } = await db.from("mercado_pago_orders")
      .select("checkout_url").eq("order_id", order.id).single();
    if (paymentError) return reply({ error: "Não foi possível recuperar o pedido." }, 503);
    if (payment.checkout_url) return reply({ checkoutUrl: payment.checkout_url });

    const returnUrl = new URL(`/pedido-confirmado?mp=${order.id}&pedido=${encodeURIComponent(order.order_number)}`, site).href;
    const total = Number(order.total).toFixed(2);
    const response = await fetch(api, {
      method: "POST",
      headers: { ...providerHeaders, "Content-Type": "application/json", "X-Idempotency-Key": order.id },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        type: "online",
        // CONFERIR na doc de Orders/Checkout Pro se "manual" é o valor certo; testar no sandbox.
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
  } catch (e) {
    console.error("mercado-pago error", e);
    return reply({ error: "Não foi possível concluir a operação." }, 503);
  }
});
