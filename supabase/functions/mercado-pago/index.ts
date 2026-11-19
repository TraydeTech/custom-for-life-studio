// Pagamentos da loja pelo Mercado Pago (Checkout Transparente: cartão de crédito e Pix).
//
// Ações (POST, com login do cliente):
//   { action: "pay", attempt, delivery, payment }  → reserva o pedido e cobra
//   { action: "status", order_id }                 → consulta e atualiza o pedido
// Avisos do Mercado Pago (POST):
//   ?data.id=<id>&type=payment  ou  ?id=<id>&topic=payment
//   → a função consulta o pagamento na API e aplica o status que a API devolver.
//
// Secrets: MERCADO_PAGO_ACCESS_TOKEN (obrigatório), MERCADO_PAGO_WEBHOOK_SECRET (confere a assinatura).
// O valor cobrado sai SEMPRE do banco (reserve_mercado_pago_order), nunca do navegador.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYMENTS_API = "https://api.mercadopago.com/v1/payments";
const SITE = Deno.env.get("SITE_URL") || "https://www.customforlife.com.br";
const ORIGINS = new Set([new URL(SITE).origin, "https://www.customforlife.com.br", "https://customforlife.com.br"]);
// Frete fixo fora de Blumenau (manter igual a FIXED_SHIPPING em src/lib/store-config.ts).
const FIXED_SHIPPING = 25;
const MAX_INSTALLMENTS = 10;
const PIX_MINUTES = 30;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const PAYMENT_ID = /^\d{1,20}$/;

type Db = ReturnType<typeof createClient>;

// ── Mercado Pago ──────────────────────────────────────────────────────────
function methodOf(payment: any): string {
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

async function fetchPayment(token: string, id: string) {
  const res = await fetch(`${PAYMENTS_API}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  return { status: res.status, payment: res.ok ? await res.json() : null };
}

// Aplica no banco o estado de um pagamento buscado na API do Mercado Pago.
async function applyPayment(db: Db, payment: any): Promise<{ paid: boolean; status: string }> {
  const orderId = payment.external_reference;
  const id = String(payment.id);
  const status = String(payment.status ?? "");

  if (status === "approved") {
    // O pagamento aprovado vira a referência do pedido (cobre Pix antigo pago depois).
    await db.from("mercado_pago_orders").update({ provider_id: id }).eq("order_id", orderId);
    const { data, error } = await db.rpc("confirm_mercado_pago_order", {
      local_id: orderId, payment_id: id, paid_amount: payment.transaction_amount,
      method: methodOf(payment), n_installments: payment.installments || 1,
    });
    if (error) throw new Error(`confirm failed: ${error.message}`);
    if (data !== "confirmed" && data !== "already_paid") {
      console.error("payment not confirmed", id, data, payment.transaction_amount);
    }
    return { paid: data === "confirmed" || data === "already_paid", status: String(data) };
  }

  if (status === "refunded" || status === "charged_back") {
    const { data, error } = await db.rpc("refund_mercado_pago_order", { local_id: orderId, payment_id: id });
    if (error) throw new Error(`refund failed: ${error.message}`);
    return { paid: false, status: String(data) };
  }

  // Pix expirado: devolve o estoque, só se for a tentativa atual do pedido.
  if (status === "cancelled") {
    const { data: link } = await db.from("mercado_pago_orders").select("provider_id").eq("order_id", orderId).maybeSingle();
    if (link?.provider_id === id) {
      const { error } = await db.rpc("release_mercado_pago_order", { local_id: orderId });
      if (error) throw new Error(`release failed: ${error.message}`);
    }
    return { paid: false, status: "cancelled" };
  }

  // rejected / pending / in_process: o pedido segue reservado para nova tentativa.
  return { paid: false, status: status || "pending" };
}

async function validSignature(req: Request, id: string, secret: string): Promise<boolean> {
  const requestId = req.headers.get("x-request-id");
  const parts = new URLSearchParams(req.headers.get("x-signature")?.replaceAll(",", "&").replaceAll(" ", ""));
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!requestId || !ts || !/^\d+$/.test(ts) || !v1 || !/^[a-f0-9]{64}$/i.test(v1)) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sig = Uint8Array.from(v1.match(/../g)!, (h) => parseInt(h, 16));
  return crypto.subtle.verify("HMAC", key, sig, enc.encode(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`));
}

// Sobe a prévia da gravação (data URL) para o Storage e grava o link no item.
async function uploadPreviews(db: Db, userId: string, orderId: string) {
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

// Valida o endereço e define o frete no servidor (o cliente não escolhe o valor).
async function buildDelivery(input: any): Promise<{ delivery?: Record<string, unknown>; error?: string }> {
  const fields = ["name", "phone", "street", "number", "complement", "neighborhood", "zip_code", "delivery_method"];
  const delivery: Record<string, unknown> = Object.fromEntries(fields.map((f) => [
    f, typeof input?.[f] === "string" ? input[f].trim().slice(0, 250) : "",
  ]));
  if (!delivery.name || !delivery.phone) return { error: "Preencha seu nome e telefone." };

  if (delivery.delivery_method === "pickup") {
    delivery.shipping_cost = 0;
    return { delivery };
  }
  if (delivery.delivery_method !== "delivery") return { error: "Escolha a forma de entrega." };

  const zip = String(delivery.zip_code).replace(/\D/g, "");
  if (!/^\d{8}$/.test(zip) || !delivery.street || !delivery.number || !delivery.neighborhood) {
    return { error: "Confira o endereço de entrega." };
  }
  const res = await fetch(`https://viacep.com.br/ws/${zip}/json/`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return { error: "Não foi possível validar o CEP. Tente novamente." };
  const cep = await res.json();
  if (cep.erro || !cep.localidade || !cep.uf) return { error: "CEP não encontrado. Confira o endereço de entrega." };
  const blumenau = cep.localidade === "Blumenau" && cep.uf === "SC";
  Object.assign(delivery, {
    city: cep.localidade, state: cep.uf, zip_code: zip,
    free_shipping: blumenau, shipping_cost: blumenau ? 0 : FIXED_SHIPPING,
  });
  return { delivery };
}

// ── Handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Origin": origin && ORIGINS.has(origin) ? origin : new URL(SITE).origin,
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };
  const reply = (body: object, status = 200) => Response.json(body, { headers, status });
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "Método inválido." }, 405);

  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  // Sem o secret do webhook os pagamentos funcionam; só o webhook fica parado
  // (responde 503 e o Mercado Pago reenvia depois que o secret for salvo).
  const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!token) return reply({ error: "Pagamento online indisponível." }, 503);

  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const query = new URL(req.url).searchParams;

    // ── Webhook do Mercado Pago ──
    // O Mercado Pago troca a query da notification_url: o aviso chega como
    //   ?data.id=<id>&type=payment   (Webhook, com x-signature) ou
    //   ?id=<id>&topic=payment       (IPN legado, sem assinatura).
    const dataId = query.get("data.id");
    const ipnId = query.get("id");
    const kind = query.get("type") || query.get("topic") || "";
    const isNotification = query.get("webhook") === "1" || Boolean(dataId) || Boolean(ipnId && kind) ||
      req.headers.has("x-signature");

    if (isNotification) {
      const id = dataId || ipnId || "";
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return reply({ error: "Notificação inválida." }, 400);

      // Segurança: o status aplicado vem SEMPRE da consulta à API do Mercado Pago (com o
      // Access Token), nunca do corpo do aviso. Um aviso falso só faria a função conferir um
      // pagamento real. Por isso a assinatura é registrada, mas não bloqueia: os avisos reais
      // gerados pela notification_url nem sempre trazem uma x-signature que confere.
      if (req.headers.has("x-signature")) {
        const ok = secret ? await validSignature(req, id, secret) : false;
        if (!ok) console.warn("webhook: signature not verified, checking payment via API", id);
      }
      // Só pagamentos interessam; outros eventos e IDs do simulador recebem 200.
      if (kind !== "payment" || !PAYMENT_ID.test(id)) return reply({ received: true, ignored: true });

      const { status, payment } = await fetchPayment(token, id);
      if (status === 404) return reply({ received: true, ignored: "not_found" });
      if (!payment) return reply({ error: "Falha na consulta do pagamento." }, 502);
      if (String(payment.id) !== id || payment.currency_id !== "BRL" || !UUID.test(payment.external_reference ?? "")) {
        return reply({ received: true });
      }
      await applyPayment(db, payment);
      return reply({ received: true });
    }

    // ── Ações do cliente (login obrigatório) ──
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return reply({ error: "Entre na sua conta." }, 401);
    const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await auth.auth.getUser(authorization.slice(7));
    if (!user) return reply({ error: "Entre na sua conta." }, 401);
    const body = await req.json();

    if (body.action === "status") {
      if (typeof body.order_id !== "string" || !UUID.test(body.order_id)) return reply({ error: "Pedido inválido." }, 400);
      const { data: order } = await db.from("orders")
        .select("id, payment_status, mercado_pago_orders(provider_id)")
        .eq("id", body.order_id).eq("user_id", user.id).maybeSingle();
      if (!order) return reply({ error: "Pedido não encontrado." }, 404);
      if (order.payment_status === "paid") return reply({ paid: true, status: "paid" });
      const link: any = Array.isArray(order.mercado_pago_orders) ? order.mercado_pago_orders[0] : order.mercado_pago_orders;
      if (!link?.provider_id || !PAYMENT_ID.test(link.provider_id)) return reply({ paid: false, status: order.payment_status });
      const { payment } = await fetchPayment(token, link.provider_id);
      if (!payment || String(payment.id) !== link.provider_id || payment.external_reference !== order.id) {
        return reply({ paid: false, status: "unknown" });
      }
      return reply(await applyPayment(db, payment));
    }

    if (body.action !== "pay") return reply({ error: "Ação inválida." }, 400);
    if (typeof body.attempt !== "string" || !UUID.test(body.attempt)) return reply({ error: "Pedido inválido." }, 400);

    const { delivery, error: deliveryError } = await buildDelivery(body.delivery);
    if (!delivery) return reply({ error: deliveryError }, 400);

    const { data: order, error: orderError } = await db.rpc("reserve_mercado_pago_order", {
      buyer: user.id, attempt: body.attempt, delivery,
    });
    if (orderError || !order) {
      console.error("reserve failed", orderError?.message);
      return reply({ error: "Não foi possível reservar o pedido. Confira o carrinho e o estoque." }, 409);
    }
    if (order.status !== "pending" || order.payment_status !== "pending") {
      return reply({ error: "Este pedido já foi processado. Confira em Meus pedidos." }, 409);
    }
    await uploadPreviews(db, user.id, order.id);

    // Detalhes da compra para o antifraude do Mercado Pago (melhora a aprovação).
    const { data: items } = await db.from("order_items")
      .select("product_id, product_name, quantity, unit_price").eq("order_id", order.id);
    const [firstName, ...lastNames] = String(delivery.name).split(/\s+/);
    const phone = String(delivery.phone).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    const additionalInfo = {
      items: (items ?? []).map((i: any) => ({
        id: String(i.product_id), title: String(i.product_name).slice(0, 250),
        quantity: i.quantity, unit_price: Number(i.unit_price), category_id: "others",
      })),
      payer: {
        first_name: firstName,
        last_name: lastNames.join(" ") || undefined,
        phone: phone.length >= 10 ? { area_code: phone.slice(0, 2), number: phone.slice(2) } : undefined,
      },
      shipments: delivery.delivery_method === "delivery" ? {
        receiver_address: {
          zip_code: delivery.zip_code, street_name: delivery.street, street_number: delivery.number,
          city_name: delivery.city, state_name: delivery.state,
        },
      } : undefined,
    };

    const selected = body.payment?.selectedPaymentMethod;
    const form = body.payment?.formData ?? {};
    const doc = form.payer?.identification;
    const payload: Record<string, unknown> = {
      transaction_amount: Math.round(Number(order.total) * 100) / 100,
      description: `Pedido ${order.order_number} - Custom For Life`,
      external_reference: order.id,
      notification_url: `${url}/functions/v1/mercado-pago?webhook=1`,
      payer: {
        email: typeof form.payer?.email === "string" && form.payer.email ? form.payer.email : user.email,
        first_name: firstName,
        last_name: lastNames.join(" ") || undefined,
        identification: doc?.type && doc?.number ? { type: String(doc.type), number: String(doc.number) } : undefined,
      },
      metadata: { order_id: order.id, order_number: order.order_number },
      additional_info: additionalInfo,
    };

    if (selected === "credit_card") {
      if (typeof form.token !== "string" || typeof form.payment_method_id !== "string") {
        return reply({ error: "Confira os dados do cartão." }, 400);
      }
      Object.assign(payload, {
        token: form.token,
        payment_method_id: form.payment_method_id,
        issuer_id: form.issuer_id ? String(form.issuer_id) : undefined,
        installments: Math.min(Math.max(1, Math.floor(Number(form.installments) || 1)), MAX_INSTALLMENTS),
        statement_descriptor: "CUSTOMFORLIFE",
      });
    } else if (selected === "bank_transfer") {
      Object.assign(payload, {
        payment_method_id: "pix",
        date_of_expiration: new Date(Date.now() + PIX_MINUTES * 60_000).toISOString(),
      });
    } else {
      return reply({ error: "Escolha cartão de crédito ou Pix." }, 400);
    }

    const res = await fetch(PAYMENTS_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
        // Identificação do aparelho (security.js) para o antifraude.
        ...(typeof body.deviceId === "string" && /^[\w-]{1,128}$/.test(body.deviceId) ? { "X-meli-session-id": body.deviceId } : {}),
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify(payload),
    });
    const payment = await res.json().catch(() => ({}));
    if (!res.ok || !payment?.id) {
      console.error("create payment failed", res.status, payment?.message, JSON.stringify(payment?.cause ?? null));
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
    // Diagnóstico de recusa (sem dados do cartão): ajuda a entender o antifraude.
    console.log("payment rejected", JSON.stringify({
      payment_id: payment.id, status_detail: payment.status_detail, method: payment.payment_method_id,
      amount: payment.transaction_amount, device_id_sent: typeof body.deviceId === "string" && body.deviceId.length > 0,
      has_identification: Boolean(doc?.number), items: additionalInfo.items.length,
    }));
    return reply({ error: rejectionMessage(String(payment.status_detail ?? "")) }, 402);
  } catch (e) {
    console.error("mercado-pago error", e);
    return reply({ error: "Não foi possível concluir a operação." }, 503);
  }
});
