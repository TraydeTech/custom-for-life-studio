import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Iugu sends webhooks as form-urlencoded or JSON
    let body: any;
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
      // Parse nested data if present
      if (body.data) {
        try {
          body.data = JSON.parse(body.data);
        } catch {}
      }
    } else {
      body = await req.json();
    }

    console.log("Iugu webhook received:", JSON.stringify(body));

    const event = body.event;
    const invoiceId = body.data?.id || body.data?.invoice_id;

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "No invoice ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "invoice.status_changed" || event === "invoice.payment_received") {
      const status = body.data?.status;

      if (status === "paid") {
        // Find order by iugu_invoice_id
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("id, total, payment_method, payment_status")
          .eq("iugu_invoice_id", invoiceId)
          .single();

        if (orderError || !order) {
          console.error("Order not found for invoice:", invoiceId);
          return new Response(JSON.stringify({ ok: true, message: "Order not found" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Skip if already paid
        if (order.payment_status === "paid") {
          return new Response(JSON.stringify({ ok: true, message: "Already paid" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update order status
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            status: "paid",
            paid_at: new Date().toISOString(),
            pdv_status: "em_producao",
          })
          .eq("id", order.id);

        // Create financial transaction if not exists
        const { data: existingTx } = await supabase
          .from("financial_transactions")
          .select("id")
          .eq("iugu_invoice_id", invoiceId)
          .maybeSingle();

        if (!existingTx) {
          const paymentMethod = order.payment_method || "pix";
          let feeRate = 0.01; // PIX default
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

        // Update accounts_receivable for this order
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
