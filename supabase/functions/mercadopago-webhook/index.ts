import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyPaymentToOrder, getPayment, json } from "../_shared/mercadopago.ts";

// Recebe notificações do Mercado Pago (tópico "payment").
// 1. Valida a assinatura x-signature com MERCADOPAGO_WEBHOOK_SECRET.
// 2. Busca o pagamento na API do MP (nunca confia no corpo da notificação).
// 3. Atualiza o pedido de forma idempotente.
// Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function isValidSignature(req: Request, dataId: string, secret: string): Promise<boolean> {
  const xSignature = req.headers.get("x-signature") || "";
  const xRequestId = req.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string]),
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  // Manifest conforme documentação; campos ausentes são omitidos.
  let manifest = "";
  if (dataId) manifest += `id:${dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = await hmacSha256Hex(secret, manifest);
  return timingSafeEqual(expected, v1);
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Assinatura é OBRIGATÓRIA: sem ela, eventos forjados poderiam marcar pedidos como pagos.
  const secret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
  if (!secret) {
    console.error("mercadopago-webhook: MERCADOPAGO_WEBHOOK_SECRET not configured");
    return json({ error: "Webhook not configured" }, 503);
  }

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const type = url.searchParams.get("type") || url.searchParams.get("topic") || (body as any).type;
    const rawId = url.searchParams.get("data.id") || (body as any)?.data?.id || "";
    // MP pede id em minúsculas quando alfanumérico.
    const dataId = String(rawId).toLowerCase();

    if (!(await isValidSignature(req, dataId, secret))) {
      console.error("mercadopago-webhook: invalid signature");
      return json({ error: "Invalid signature" }, 401);
    }

    if (type !== "payment" || !/^\d+$/.test(dataId)) {
      // Outros tópicos (merchant_order, etc.) são ignorados com 200 para o MP não reenviar.
      return json({ ok: true, ignored: true }, 200);
    }

    const { ok, data: payment } = await getPayment(dataId);
    if (!ok || !payment?.id) {
      console.error("mercadopago-webhook: payment fetch failed", dataId);
      return json({ error: "Payment fetch failed" }, 502); // MP reenvia depois
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { orderId, paid } = await applyPaymentToOrder(service, payment);

    if (paid && orderId) {
      // Tabela opcional — ignora erro se não existir.
      await service
        .from("accounts_receivable")
        .update({ status: "paid", paid_date: new Date().toISOString().split("T")[0] })
        .eq("order_id", orderId)
        .then(() => {}, () => {});
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error("mercadopago-webhook error:", error);
    return json({ error: "Internal error" }, 500);
  }
});
