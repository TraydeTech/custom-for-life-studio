import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  applyPaymentToOrder,
  getAccessToken,
  getCorsHeaders,
  json,
  MpPayment,
  mpRequest,
  rejectionMessage,
  toLocalMethod,
} from "../_shared/mercadopago.ts";

// Cria pagamento no Mercado Pago (PIX, cartão de crédito ou débito).
// O valor cobrado vem SEMPRE de orders.total (servidor), nunca do cliente.
serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (!getAccessToken()) {
      return json({ error: "MERCADOPAGO_ACCESS_TOKEN not configured" }, 500, cors);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401, cors);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401, cors);
    const userId = claimsData.claims.sub;

    const {
      orderId,
      paymentMethod, // "pix" | "credit_card" | "debit_card"
      token: cardToken,
      paymentMethodId, // bandeira retornada pelo MP.js (ex.: "visa", "master", "debelo")
      issuerId,
      installments = 1,
      customerName,
      customerEmail,
      customerCpf,
    } = await req.json();

    if (!orderId || !["pix", "credit_card", "debit_card"].includes(paymentMethod)) {
      return json({ error: "orderId and a valid paymentMethod are required" }, 400, cors);
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, total, payment_status, notes")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single();
    if (orderError || !order) return json({ error: "Order not found" }, 404, cors);
    if (order.payment_status === "paid") return json({ error: "Order already paid" }, 409, cors);

    const email = customerEmail || order.notes?.match(/email:\s*(\S+)/i)?.[1] || null;
    if (!email) return json({ error: "customerEmail is required" }, 400, cors);

    const cpf = String(customerCpf || "").replace(/\D/g, "");
    const [firstName, ...rest] = String(customerName || "Cliente").trim().split(/\s+/);
    const isCard = paymentMethod !== "pix";

    if (isCard && (!cardToken || !paymentMethodId)) {
      return json({ error: "token and paymentMethodId are required for card payments" }, 400, cors);
    }

    const maxInstallments = Number(Deno.env.get("MERCADOPAGO_MAX_INSTALLMENTS") || 12);
    const nInstallments = paymentMethod === "credit_card"
      ? Math.min(Math.max(1, Math.floor(Number(installments) || 1)), maxInstallments)
      : 1;

    const payload: Record<string, unknown> = {
      transaction_amount: Math.round(Number(order.total) * 100) / 100,
      description: `Pedido ${order.order_number} - Custom For Life`,
      external_reference: order.id,
      payer: {
        email,
        first_name: firstName,
        last_name: rest.join(" ") || undefined,
        identification: cpf ? { type: "CPF", number: cpf } : undefined,
      },
      metadata: { order_id: order.id, order_number: order.order_number },
    };

    const notificationUrl = Deno.env.get("MERCADOPAGO_WEBHOOK_URL")
      || `${supabaseUrl}/functions/v1/mercadopago-webhook`;
    payload.notification_url = notificationUrl;

    if (isCard) {
      payload.token = cardToken;
      payload.payment_method_id = paymentMethodId;
      payload.installments = nInstallments;
      if (issuerId) payload.issuer_id = issuerId;
      const descriptor = Deno.env.get("MERCADOPAGO_STATEMENT_DESCRIPTOR");
      if (descriptor) payload.statement_descriptor = descriptor.slice(0, 13);
    } else {
      const minutes = Number(Deno.env.get("MERCADOPAGO_PIX_EXPIRATION_MINUTES") || 30);
      payload.payment_method_id = "pix";
      payload.date_of_expiration = new Date(Date.now() + minutes * 60_000).toISOString();
    }

    const { ok, data: payment } = await mpRequest<MpPayment & { message?: string; cause?: unknown }>(
      "/v1/payments",
      { method: "POST", body: payload, idempotencyKey: crypto.randomUUID() },
    );

    if (!ok || !payment?.id) {
      console.error("Mercado Pago error:", payment);
      return json({ error: "Payment gateway error", message: payment?.message }, 400, cors);
    }

    const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Registra a tentativa atual no pedido antes de aplicar o status.
    await service
      .from("orders")
      .update({
        mp_payment_id: String(payment.id),
        payment_method: toLocalMethod(payment.payment_type_id || (isCard ? paymentMethod : "pix")),
        installments: nInstallments,
      })
      .eq("id", order.id);

    await applyPaymentToOrder(service, payment);

    if (isCard) {
      if (payment.status === "approved") {
        return json({ success: true, paymentId: payment.id, status: "paid" }, 200, cors);
      }
      if (payment.status === "in_process" || payment.status === "pending") {
        return json({
          success: true,
          paymentId: payment.id,
          status: "pending",
          message: "Pagamento em análise. Você receberá a confirmação em breve.",
        }, 200, cors);
      }
      return json({
        error: "Payment declined",
        statusDetail: payment.status_detail,
        message: rejectionMessage(payment.status_detail),
      }, 402, cors);
    }

    const tx = payment.point_of_interaction?.transaction_data;
    return json({
      success: true,
      paymentId: payment.id,
      status: "pending",
      pixQrCodeText: tx?.qr_code,
      pixQrCodeBase64: tx?.qr_code_base64,
      ticketUrl: tx?.ticket_url,
      expiresAt: payload.date_of_expiration,
    }, 200, cors);
  } catch (error) {
    console.error("create-payment error:", error);
    return json({ error: "Internal server error" }, 500, cors);
  }
});
