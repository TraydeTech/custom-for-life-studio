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
    const IUGU_API_KEY = Deno.env.get("IUGU_API_KEY");
    if (!IUGU_API_KEY) {
      return new Response(
        JSON.stringify({ error: "IUGU_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: "invoiceId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const iuguAuth = btoa(`${IUGU_API_KEY}:`);
    const response = await fetch(`https://api.iugu.com/v1/invoices/${invoiceId}`, {
      headers: { Authorization: `Basic ${iuguAuth}` },
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to check payment status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If paid, update the order
    if (data.status === "paid") {
      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Find and update the order
      const { data: order } = await serviceClient
        .from("orders")
        .select("id, total, payment_method")
        .eq("iugu_invoice_id", invoiceId)
        .single();

      if (order) {
        await serviceClient
          .from("orders")
          .update({
            payment_status: "paid",
            paid_at: new Date().toISOString(),
            pdv_status: "em_producao",
            status: "paid",
          })
          .eq("id", order.id);

        // Create financial transaction if not exists
        const { data: existingTx } = await serviceClient
          .from("financial_transactions")
          .select("id")
          .eq("iugu_invoice_id", invoiceId)
          .maybeSingle();

        if (!existingTx) {
          const feeRate = (order.payment_method === "pix") ? 0.01 : 0.025;
          const grossAmount = Number(order.total);
          const gatewayFee = grossAmount * feeRate;
          await serviceClient.from("financial_transactions").insert({
            order_id: order.id,
            payment_method: order.payment_method || "pix",
            gross_amount: grossAmount,
            gateway_fee: Math.round(gatewayFee * 100) / 100,
            net_amount: Math.round((grossAmount - gatewayFee) * 100) / 100,
            status: "confirmed",
            iugu_invoice_id: invoiceId,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: data.status,
        paid: data.status === "paid",
        paidAt: data.paid_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-payment-status error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
