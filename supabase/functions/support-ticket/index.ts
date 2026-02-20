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
    // GET - Fetch ticket + messages
    if (req.method === "GET") {
      const url = new URL(req.url);
      const ticketNumber = url.searchParams.get("ticket_number");

      if (!ticketNumber) {
        return new Response(
          JSON.stringify({ error: "ticket_number is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets_suporte")
        .select("*")
        .eq("numero_ticket", ticketNumber)
        .single();

      if (ticketError || !ticket) {
        return new Response(
          JSON.stringify({ error: "Ticket not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: messages } = await supabase
        .from("suporte_mensagens")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });

      // Map to standardized API format
      const formattedMessages = (messages || []).map((m: any) => ({
        id: m.id,
        sender_name: m.remetente,
        sender_type: m.remetente === "suporte" ? "admin" : "client",
        message: m.mensagem,
        created_at: m.created_at,
      }));

      return new Response(
        JSON.stringify({
          success: true,
          ticket_number: ticket.numero_ticket,
          status: ticket.status,
          subject: ticket.tipo,
          description: ticket.descricao,
          client_email: ticket.usuario_email,
          created_at: ticket.created_at,
          resolved_at: ticket.resolvido_em,
          messages: formattedMessages,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();

      // POST with action: "send_message" - Add message to existing ticket
      if (body.action === "send_message") {
        const { ticket_number, sender_name, message } = body;

        if (!ticket_number || !message) {
          return new Response(
            JSON.stringify({ error: "ticket_number and message are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: ticket, error: ticketError } = await supabase
          .from("tickets_suporte")
          .select("id, status")
          .eq("numero_ticket", ticket_number)
          .single();

        if (ticketError || !ticket) {
          return new Response(
            JSON.stringify({ error: "Ticket not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const remetente = sender_name || "cliente";
        const { error: msgError } = await supabase
          .from("suporte_mensagens")
          .insert({
            ticket_id: ticket.id,
            mensagem: message,
            remetente,
            lida: false,
          });

        if (msgError) {
          throw new Error(`Erro ao enviar mensagem: ${msgError.message}`);
        }

        // If ticket was resolved, reopen it
        if (ticket.status === "resolvido") {
          await supabase
            .from("tickets_suporte")
            .update({ status: "em_andamento", updated_at: new Date().toISOString() })
            .eq("id", ticket.id);
        }

        // Sync message to Trayde Tech via their API
        const TRAYDE_SUPPORT_API = "https://yblxrbmtbxtopctuuqjr.supabase.co/functions/v1/support-ticket";
        try {
          const syncRes = await fetch(TRAYDE_SUPPORT_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "send_message",
              ticket_number,
              sender_name: remetente,
              message,
            }),
          });

          if (syncRes.ok) {
            console.log("✅ Mensagem sincronizada com Trayde Tech");
          } else {
            console.error("❌ Erro ao sincronizar:", await syncRes.text());
          }
        } catch (e) {
          console.error("❌ Erro de conexão com Trayde Tech:", e);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Accept both Portuguese and English field names
      const tipo = body.tipo || body.subject || "";
      const descricao = body.descricao || body.description || "";
      const prioridade = body.prioridade || body.priority || "media";
      const usuario_email = body.usuario_email || body.client_email || "";
      const usuario_id = body.usuario_id || null;
      const userName = body.userName || body.client_name || "";
      const clientSystem = body.clientSystem || body.client_system || "";
      const anexo_base64 = body.anexo_base64 || null;
      const anexo_nome = body.anexo_nome || null;

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

          const sanitizedName = anexo_nome
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9._-]/g, "_");
          const filePath = `${ticket.id}/${sanitizedName}`;
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
          console.log("Syncing to Trayde Tech...", { 
            urlConfigured: !!traydeUrl, 
            keyConfigured: !!traydeKey,
            urlPrefix: traydeUrl.substring(0, 10) 
          });
          const trayde = createClient(traydeUrl, traydeKey);
          const { data: traydeData, error: traydeError } = await trayde
            .from("support_tickets")
            .insert({
              ticket_number: ticketNumber,
              subject: tipo,
              description: descricao + (anexoUrl ? `\n\nAnexo: ${anexoUrl}` : ""),
              client_email: usuario_email,
              client_name: userName || "",
              client_system: clientSystem || "",
              priority: prioridade || "media",
              status: "aberto",
            });
          
          if (traydeError) {
            console.error("Erro Trayde insert:", traydeError.message, traydeError.details);
          } else {
            console.log("Ticket synced to Trayde Tech successfully");
          }
        } catch (e) {
          console.error("Erro ao sincronizar com Trayde Tech:", e);
        }
      } else {
        console.warn("Trayde Tech not configured - skipping sync", { 
          hasUrl: !!traydeUrl, 
          hasKey: !!traydeKey 
        });
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
