import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST/PATCH
  if (req.method !== "POST" && req.method !== "PATCH") {
    return new Response(
      JSON.stringify({ error: "Método não suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate API key from Trayde Tech
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("TRAYDE_SERVICE_ROLE_KEY");
  if (!apiKey || apiKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: "Não autorizado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { ticket_number, status, response, responder_name } = body;

    if (!ticket_number) {
      return new Response(
        JSON.stringify({ error: "ticket_number é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the ticket
    const { data: ticket, error: findError } = await supabase
      .from("tickets_suporte")
      .select("id, status")
      .eq("numero_ticket", ticket_number)
      .single();

    if (findError || !ticket) {
      return new Response(
        JSON.stringify({ error: "Ticket não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update ticket status and response
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (response) updateData.resposta = response;
    if (status === "resolvido") updateData.resolvido_em = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("tickets_suporte")
      .update(updateData)
      .eq("id", ticket.id);

    if (updateError) {
      throw new Error(`Erro ao atualizar ticket: ${updateError.message}`);
    }

    // Insert message into suporte_mensagens
    if (response) {
      const { error: msgError } = await supabase
        .from("suporte_mensagens")
        .insert({
          ticket_id: ticket.id,
          mensagem: response,
          remetente: responder_name || "Suporte",
          lida: false,
        });

      if (msgError) {
        console.error("Erro ao inserir mensagem:", msgError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, ticket_id: ticket.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-ticket-response error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
