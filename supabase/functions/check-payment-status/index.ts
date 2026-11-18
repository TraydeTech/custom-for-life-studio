import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  applyPaymentToOrder,
  getAccessToken,
  getCorsHeaders,
  getPayment,
  json,
} from "../_shared/mercadopago.ts";

// Consulta o status de um pagamento no Mercado Pago (polling do PIX no checkout).
// Fallback do webhook: se o pagamento foi aprovado, já marca o pedido como pago.
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

    const { paymentId } = await req.json();
    if (!paymentId || !/^\d+$/.test(String(paymentId))) {
      return json({ error: "paymentId is required" }, 400, cors);
    }

    const { ok, data: payment } = await getPayment(paymentId);
    if (!ok || !payment?.id) return json({ error: "Failed to check payment status" }, 400, cors);

    // O pagamento precisa pertencer a um pedido do usuário autenticado.
    const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: owned } = await service
      .from("orders")
      .select("id")
      .eq("id", payment.external_reference ?? "")
      .eq("user_id", userId)
      .maybeSingle();
    if (!owned) return json({ error: "Payment not found" }, 404, cors);

    const { paid } = await applyPaymentToOrder(service, payment);

    return json({
      status: payment.status,
      statusDetail: payment.status_detail,
      paid,
      paidAt: payment.date_approved,
    }, 200, cors);
  } catch (error) {
    console.error("check-payment-status error:", error);
    return json({ error: "Internal server error" }, 500, cors);
  }
});
