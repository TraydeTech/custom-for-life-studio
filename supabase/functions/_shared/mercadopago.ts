// Helpers compartilhados pelas edge functions de pagamento (Mercado Pago).
// Docs: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_API = "https://api.mercadopago.com";

const ALLOWED_ORIGIN = Deno.env.get("SITE_URL") || "https://customforlife.com.br";

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = origin === ALLOWED_ORIGIN || origin.endsWith(".supabase.co");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

export function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function getAccessToken(): string | null {
  return Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || null;
}

export interface MpPayment {
  id: number;
  status: string; // pending | approved | authorized | in_process | in_mediation | rejected | cancelled | refunded | charged_back
  status_detail: string;
  external_reference: string | null;
  payment_method_id: string;
  payment_type_id: string; // credit_card | debit_card | bank_transfer (pix) | ...
  transaction_amount: number;
  installments: number;
  date_approved: string | null;
  fee_details?: { amount: number }[];
  transaction_details?: { net_received_amount?: number };
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  };
}

export async function mpRequest<T>(
  path: string,
  init: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const token = getAccessToken();
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (init.idempotencyKey) headers["X-Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${MP_API}${path}`, {
    method: init.method || "GET",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as T };
}

export function getPayment(paymentId: string | number) {
  return mpRequest<MpPayment>(`/v1/payments/${encodeURIComponent(String(paymentId))}`);
}

/** Método salvo em orders.payment_method / financial_transactions (padrão do painel). */
export function toLocalMethod(paymentTypeId: string): string {
  if (paymentTypeId === "credit_card") return "credito";
  if (paymentTypeId === "debit_card") return "debito";
  return "pix";
}

/** Mensagens amigáveis para os motivos de recusa mais comuns. */
export function rejectionMessage(statusDetail: string): string {
  const map: Record<string, string> = {
    cc_rejected_bad_filled_card_number: "Número do cartão inválido.",
    cc_rejected_bad_filled_date: "Data de validade inválida.",
    cc_rejected_bad_filled_security_code: "CVV inválido.",
    cc_rejected_bad_filled_other: "Confira os dados do cartão.",
    cc_rejected_insufficient_amount: "Saldo/limite insuficiente.",
    cc_rejected_call_for_authorize: "Autorize o pagamento com o banco emissor do cartão.",
    cc_rejected_card_disabled: "Cartão desabilitado. Ligue para o banco emissor.",
    cc_rejected_duplicated_payment: "Pagamento duplicado. Aguarde alguns minutos.",
    cc_rejected_high_risk: "Pagamento recusado por segurança. Tente outro cartão ou PIX.",
    cc_rejected_max_attempts: "Limite de tentativas atingido. Tente outro cartão.",
  };
  return map[statusDetail] || "Cartão recusado. Verifique os dados ou tente outro cartão.";
}

/**
 * Aplica o status de um pagamento do Mercado Pago no pedido (idempotente).
 * Sempre chamado com dados buscados na API do MP — nunca com dados do cliente
 * ou do corpo do webhook.
 */
export async function applyPaymentToOrder(
  service: SupabaseClient,
  payment: MpPayment,
): Promise<{ orderId: string | null; paid: boolean }> {
  const orderId = payment.external_reference;
  if (!orderId) return { orderId: null, paid: false };

  const { data: order } = await service
    .from("orders")
    .select("id, total, payment_status, mp_payment_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    console.error("mercadopago: order not found for payment", payment.id);
    return { orderId: null, paid: false };
  }

  const mpPaymentId = String(payment.id);
  const method = toLocalMethod(payment.payment_type_id);

  if (payment.status === "approved") {
    // Confere valor: impede pagar menos que o total do pedido.
    if (Number(payment.transaction_amount) + 0.009 < Number(order.total)) {
      console.error("mercadopago: amount mismatch", mpPaymentId, payment.transaction_amount, order.total);
      return { orderId, paid: false };
    }

    if (order.payment_status !== "paid") {
      await service
        .from("orders")
        .update({
          payment_status: "paid",
          status: "paid",
          payment_method: method,
          mp_payment_id: mpPaymentId,
          installments: payment.installments || 1,
          paid_at: payment.date_approved || new Date().toISOString(),
          pdv_status: "em_producao",
        })
        .eq("id", orderId);
    }

    const { data: existingTx } = await service
      .from("financial_transactions")
      .select("id")
      .eq("mp_payment_id", mpPaymentId)
      .maybeSingle();

    if (!existingTx) {
      const gross = Number(payment.transaction_amount);
      const feeFromMp = (payment.fee_details || []).reduce((s, f) => s + Number(f.amount || 0), 0);
      const net = payment.transaction_details?.net_received_amount ?? gross - feeFromMp;
      await service.from("financial_transactions").insert({
        order_id: orderId,
        payment_method: method,
        gross_amount: gross,
        gateway_fee: Math.round((gross - net) * 100) / 100,
        net_amount: Math.round(net * 100) / 100,
        installments: payment.installments || 1,
        status: "confirmed",
        mp_payment_id: mpPaymentId,
      });
    }
    return { orderId, paid: true };
  }

  if (payment.status === "refunded" || payment.status === "charged_back") {
    await service.from("orders").update({ payment_status: "refunded" }).eq("id", orderId);
    await service
      .from("financial_transactions")
      .update({ status: "refunded" })
      .eq("mp_payment_id", mpPaymentId);
    return { orderId, paid: false };
  }

  if (order.payment_status === "paid") return { orderId, paid: true };
  // Evento atrasado de uma tentativa antiga não sobrescreve a tentativa atual.
  if (order.mp_payment_id && order.mp_payment_id !== mpPaymentId) return { orderId, paid: false };

  if (payment.status === "rejected" || payment.status === "cancelled") {
    await service
      .from("orders")
      .update({ payment_status: "failed", payment_method: method, mp_payment_id: mpPaymentId })
      .eq("id", orderId);
  } else if (payment.status === "in_process" || payment.status === "authorized") {
    await service
      .from("orders")
      .update({ payment_status: "processing", payment_method: method, mp_payment_id: mpPaymentId })
      .eq("id", orderId);
  }
  return { orderId, paid: false };
}
