import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("SITE_URL") || "https://customforlife.com.br";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = origin === ALLOWED_ORIGIN || origin.endsWith(".supabase.co");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const IUGU_API_KEY = Deno.env.get("IUGU_API_KEY");
    if (!IUGU_API_KEY) {
      return new Response(
        JSON.stringify({ error: "IUGU_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const {
      orderId,
      paymentMethod,
      token: cardToken,
      installments = 1,
      customerName,
      customerEmail,
      customerCpf,
    } = await req.json();

    if (!orderId || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: "orderId and paymentMethod are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get order items for invoice description
    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, quantity, unit_price")
      .eq("order_id", orderId);

    const iuguItems = (items || []).map((item: any) => ({
      description: item.product_name,
      quantity: item.quantity,
      price_cents: Math.round(Number(item.unit_price) * 100),
    }));

    // Resolve um email real do cliente — exigido pela nota fiscal Iugu.
    // Nunca usar um endereço fake: invoice com email inválido quebra cobrança/recibo.
    const resolvedEmail =
      customerEmail || order.notes?.match(/email:\s*(\S+)/i)?.[1] || null;
    if (!resolvedEmail) {
      return new Response(
        JSON.stringify({ error: "customerEmail is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Iugu invoice payload
    const invoicePayload: any = {
      email: resolvedEmail,
      due_date: new Date(Date.now() + 30 * 60 * 1000).toISOString().split("T")[0],
      items: iuguItems.length > 0 ? iuguItems : [
        { description: `Pedido ${order.order_number}`, quantity: 1, price_cents: Math.round(Number(order.total) * 100) },
      ],
      payer: {
        name: customerName || "Cliente",
        cpf_cnpj: customerCpf?.replace(/\D/g, "") || undefined,
        email: resolvedEmail,
      },
    };

    if (paymentMethod === "pix") {
      invoicePayload.payable_with = "pix";
    } else if (paymentMethod === "credit_card") {
      invoicePayload.payable_with = "credit_card";
    } else if (paymentMethod === "bank_slip") {
      invoicePayload.payable_with = "bank_slip";
    }

    // Create invoice on Iugu
    const iuguAuth = btoa(`${IUGU_API_KEY}:`);
    const iuguResponse = await fetch("https://api.iugu.com/v1/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${iuguAuth}`,
      },
      body: JSON.stringify(invoicePayload),
    });

    const iuguData = await iuguResponse.json();

    if (!iuguResponse.ok) {
      console.error("Iugu error:", iuguData);
      return new Response(
        JSON.stringify({ error: "Payment gateway error", details: iuguData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If credit card, charge immediately with the token
    let chargeResult = null;
    if ((paymentMethod === "credit_card" || paymentMethod === "debit_card") && cardToken) {
      const chargePayload: any = {
        token: cardToken,
        months: installments,
      };

      const chargeResponse = await fetch(
        `https://api.iugu.com/v1/invoices/${iuguData.id}/charge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${iuguAuth}`,
          },
          body: JSON.stringify(chargePayload),
        }
      );

      chargeResult = await chargeResponse.json();

      if (!chargeResponse.ok || !chargeResult.success) {
        // Update order as failed
        const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await serviceClient
          .from("orders")
          .update({
            payment_status: "failed",
            payment_method: paymentMethod === "credit_card" ? "credito" : "debito",
            iugu_invoice_id: iuguData.id,
          })
          .eq("id", orderId);

        return new Response(
          JSON.stringify({
            error: "Payment declined",
            message: chargeResult.message || "Cartão recusado. Verifique os dados ou tente outro cartão.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Card payment succeeded - update order
      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await serviceClient
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method: paymentMethod === "credit_card" ? "credito" : "debito",
          iugu_invoice_id: iuguData.id,
          installments,
          paid_at: new Date().toISOString(),
          pdv_status: "em_producao",
          status: "paid",
        })
        .eq("id", orderId);

      // Create financial transaction
      const feeRate = paymentMethod === "credit_card" ? 0.025 : 0.02;
      const grossAmount = Number(order.total);
      const gatewayFee = grossAmount * feeRate;
      await serviceClient.from("financial_transactions").insert({
        order_id: orderId,
        payment_method: paymentMethod === "credit_card" ? "credito" : "debito",
        gross_amount: grossAmount,
        gateway_fee: Math.round(gatewayFee * 100) / 100,
        net_amount: Math.round((grossAmount - gatewayFee) * 100) / 100,
        installments,
        status: "confirmed",
        iugu_invoice_id: iuguData.id,
      });
    } else {
      // PIX: update order with invoice ID
      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await serviceClient
        .from("orders")
        .update({
          payment_method: "pix",
          iugu_invoice_id: iuguData.id,
        })
        .eq("id", orderId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoiceId: iuguData.id,
        invoiceUrl: iuguData.secure_url,
        pixQrCode: iuguData.pix?.qrcode,
        pixQrCodeText: iuguData.pix?.qrcode_text,
        status: chargeResult ? "paid" : "pending",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("create-payment error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
