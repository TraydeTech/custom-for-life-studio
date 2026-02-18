import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Ensure TRAYDE URL has https:// prefix
  let traydeUrl = Deno.env.get("TRAYDE_SUPABASE_URL") || "";
  if (traydeUrl && !traydeUrl.startsWith("http")) {
    traydeUrl = `https://${traydeUrl}`;
  }
  const traydeKey = Deno.env.get("TRAYDE_SERVICE_ROLE_KEY") || "";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    if (req.method === "POST") {
      const body = await req.json();
      const {
        tipo,
        descricao,
        prioridade,
        usuario_email,
        usuario_id,
        userName,
        clientSystem,
        anexo_base64,
        anexo_nome,
      } = body;

      // Generate ticket number
      const now = new Date();
      const ticketNumber = `SUP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

      // Save locally
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets_suporte")
        .insert({
          numero_ticket: ticketNumber,
          tipo,
          descricao,
          usuario_email,
          usuario_id,
          status: "aberto",
        })
        .select()
        .single();

      if (ticketError) {
        console.error("Erro ao criar ticket:", ticketError);
        throw new Error(`Erro ao criar ticket: ${ticketError.message}`);
      }

      // Upload attachment if provided
      let anexoUrl = null;
      if (anexo_base64 && anexo_nome) {
        try {
          const base64Data = anexo_base64.split(",")[1] || anexo_base64;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const filePath = `${ticket.id}/${anexo_nome}`;
          const { error: uploadError } = await supabase.storage
            .from("suporte-anexos")
            .upload(filePath, bytes, { contentType: "image/png", upsert: true });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from("suporte-anexos")
              .getPublicUrl(filePath);
            anexoUrl = urlData.publicUrl;
          } else {
            console.error("Erro no upload:", uploadError);
          }
        } catch (e) {
          console.error("Erro no upload:", e);
        }
      }

      // Sync to Trayde Tech (only if configured)
      if (traydeUrl && traydeKey) {
        try {
          const trayde = createClient(traydeUrl, traydeKey);
          await trayde.from("support_tickets").insert({
            ticket_number: ticketNumber,
            subject: tipo,
            description: descricao + (anexoUrl ? `\n\nAnexo: ${anexoUrl}` : ""),
            client_email: usuario_email,
            client_name: userName || "",
            client_system: clientSystem || "",
            priority: prioridade || "media",
            status: "aberto",
          });
        } catch (e) {
          console.error("Erro ao sincronizar com Trayde Tech:", e);
          // Don't fail the request if Trayde sync fails
        }
      }

      return new Response(
        JSON.stringify({ success: true, ticket_number: ticketNumber }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "PATCH") {
      const body = await req.json();
      const { ticket_number, status, response } = body;

      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (response) updateData.resposta = response;
      if (status === "resolvido") updateData.resolvido_em = new Date().toISOString();

      const { error } = await supabase
        .from("tickets_suporte")
        .update(updateData)
        .eq("numero_ticket", ticket_number);

      if (error) {
        throw new Error(`Erro ao atualizar ticket: ${error.message}`);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Método não suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
