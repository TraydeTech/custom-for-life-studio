import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Webhooks de pagamento não precisam de CORS — vêm do servidor Iugu, não do browser
const jsonHeaders = { "Content-Type": "application/json" };

serve(async (req) => {
  // Iugu não envia OPTIONS — rejeitar outros métodos
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse body (Iugu envia form-urlencoded ou JSON)
    let body: any;
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
      if (body.data) {
        try { body.data = JSON.parse(body.data); } catch {}
      }
    } else {
      body = await req.json();
    }

    // ── Verificação de token Iugu ─────────────────────────────────────────
    // Configure IUGU_WEBHOOK_TOKEN no painel Supabase → Edge Functions → Secrets
    // com o mesmo valor configurado em Iugu → Webhooks → Token de verificação.
    const webhookToken = Deno.env.get("IUGU_WEBHOOK_TOKEN");
    if (webhookToken) {
      const receivedToken = body.token as string | undefined;
      if (!receivedToken || receivedToken !== webhookToken) {
        console.error("Webhook token inválido");
        // Retorna 200 para o Iugu não retentar, mas não processa
        return new Response(JSON.stringify({ ok: false, message: "Invalid token" }), {
          status: 200,
          headers: jsonHeaders,
        });
      }
    }

    const event = body.event;
    const invoiceId = body.data?.id || body.data?.invoice_id;

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "No invoice ID" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (event === "invoice.status_changed" || event === "invoice.payment_received") {
      const status = body.data?.status;

      if (status === "paid") {
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("id, total, payment_method, payment_status")
          .eq("iugu_invoice_id", invoiceId)
          .single();

        if (orderError || !order) {
          console.error("Order not found for invoice:", invoiceId);
          return new Response(JSON.stringify({ ok: true, message: "Order not found" }), {
            status: 200,
            headers: jsonHeaders,
          });
        }

        // Idempotência: ignora se já pago
        if (order.payment_status === "paid") {
          return new Response(JSON.stringify({ ok: true, message: "Already paid" }), {
            status: 200,
            headers: jsonHeaders,
          });
        }

        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            status: "paid",
            paid_at: new Date().toISOString(),
            pdv_status: "em_producao",
          })
          .eq("id", order.id);

        // Transação financeira (idempotente por iugu_invoice_id)
        const { data: existingTx } = await supabase
          .from("financial_transactions")
          .select("id")
          .eq("iugu_invoice_id", invoiceId)
          .maybeSingle();

        if (!existingTx) {
          const paymentMethod = order.payment_method || "pix";
          let feeRate = 0.01;
          if (paymentMethod === "credito") feeRate = 0.025;
          else if (paymentMethod === "debito") feeRate = 0.02;

          const grossAmount = Number(order.total);
          const gatewayFee = grossAmount * feeRate;

          await supabase.from("financial_transactions").insert({
            order_id: order.id,
            payment_method: paymentMethod,
            gross_amount: grossAmount,
            gateway_fee: Math.round(gatewayFee * 100) / 100,
            net_amount: Math.round((grossAmount - gatewayFee) * 100) / 100,
            status: "confirmed",
            iugu_invoice_id: invoiceId,
          });
        }

        await supabase
          .from("accounts_receivable")
          .update({ status: "paid", paid_date: new Date().toISOString().split("T")[0] })
          .eq("order_id", order.id);

        console.log("Order paid:", order.id);

      } else if (status === "refunded") {
        const { data: order } = await supabase
          .from("orders")
          .select("id")
          .eq("iugu_invoice_id", invoiceId)
          .single();

        if (order) {
          await supabase
            .from("orders")
            .update({ payment_status: "refunded" })
            .eq("id", order.id);

          await supabase
            .from("financial_transactions")
            .update({ status: "refunded" })
            .eq("iugu_invoice_id", invoiceId);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  }
});
