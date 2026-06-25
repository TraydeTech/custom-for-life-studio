import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("SITE_URL") || "https://customforlife.com.br";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = origin === ALLOWED_ORIGIN || origin.endsWith(".supabase.co") || origin.endsWith(".lovable.app") || origin.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-sync-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

type Caller =
  | { kind: "internal" }
  | { kind: "user"; userId: string; email: string | null; isAdmin: boolean };

async function resolveCaller(req: Request, adminClient: any): Promise<Caller | null> {
  // Internal cross-project sync (Trayde Tech → us)
  const internalToken = Deno.env.get("INTERNAL_SUPPORT_SYNC_TOKEN");
  const providedSync = req.headers.get("x-internal-sync-token");
  if (internalToken && providedSync && providedSync === internalToken) {
    return { kind: "internal" };
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  return {
    kind: "user",
    userId: data.user.id,
    email: data.user.email ?? null,
    isAdmin: !!roleRow,
  };
}

function unauthorized(corsHeaders: Record<string, string>, msg = "Unauthorized") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function forbidden(corsHeaders: Record<string, string>, msg = "Forbidden") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let traydeUrl = Deno.env.get("TRAYDE_SUPABASE_URL") || "";
  if (traydeUrl && !traydeUrl.startsWith("http")) traydeUrl = `https://${traydeUrl}`;
  const traydeKey = Deno.env.get("TRAYDE_SERVICE_ROLE_KEY") || "";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let caller: Caller | null;
  try {
    caller = await resolveCaller(req, supabase);
  } catch (e) {
    console.error("auth resolve error", e);
    caller = null;
  }
  if (!caller) return unauthorized(corsHeaders);

  const isInternal = caller.kind === "internal";
  const isAdmin = caller.kind === "user" && caller.isAdmin;
  const callerUserId = caller.kind === "user" ? caller.userId : null;
  const callerEmail = caller.kind === "user" ? caller.email : null;

  // Helper: signed URL for support attachments
  async function signAttachment(filePath: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from("suporte-anexos")
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days
    if (error) {
      console.error("signed url error", error);
      return null;
    }
    return data?.signedUrl ?? null;
  }

  try {
    // ─── GET ───────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const url = new URL(req.url);
      const ticketNumber = url.searchParams.get("ticket_number");
      if (!ticketNumber) {
        return new Response(JSON.stringify({ error: "ticket_number is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets_suporte").select("*")
        .eq("numero_ticket", ticketNumber).single();

      if (ticketError || !ticket) {
        return new Response(JSON.stringify({ error: "Ticket not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authorization: internal or admin OR owner of ticket
      if (!isInternal && !isAdmin && ticket.usuario_id !== callerUserId) {
        return forbidden(corsHeaders);
      }

      const { data: messages } = await supabase
        .from("suporte_mensagens").select("*")
        .eq("ticket_id", ticket.id).order("created_at", { ascending: true });

      const formattedMessages = (messages || []).map((m: any) => ({
        id: m.id,
        sender_name: m.remetente,
        sender_type: m.remetente === "suporte" ? "admin" : "client",
        message: m.mensagem,
        created_at: m.created_at,
      }));

      return new Response(JSON.stringify({
        success: true,
        ticket_number: ticket.numero_ticket,
        status: ticket.status,
        subject: ticket.tipo,
        description: ticket.descricao,
        client_email: ticket.usuario_email,
        created_at: ticket.created_at,
        resolved_at: ticket.resolvido_em,
        messages: formattedMessages,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── POST ──────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json();

      // update_status — admin or internal only
      if (body.action === "update_status") {
        if (!isAdmin && !isInternal) return forbidden(corsHeaders);
        const { ticket_number, status, response } = body;
        if (!ticket_number || !status) {
          return new Response(JSON.stringify({ error: "ticket_number and status are required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const updateData: Record<string, unknown> = {
          status, updated_at: new Date().toISOString(),
        };
        if (status === "resolvido") updateData.resolvido_em = new Date().toISOString();
        if (response) updateData.resposta = response;

        const { error } = await supabase.from("tickets_suporte")
          .update(updateData).eq("numero_ticket", ticket_number);
        if (error) throw new Error(`Erro ao atualizar status: ${error.message}`);

        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // send_message
      if (body.action === "send_message") {
        const { ticket_number, message } = body;
        if (!ticket_number || !message) {
          return new Response(JSON.stringify({ error: "ticket_number and message are required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: ticket, error: ticketError } = await supabase
          .from("tickets_suporte").select("id, status, usuario_id")
          .eq("numero_ticket", ticket_number).single();
        if (ticketError || !ticket) {
          return new Response(JSON.stringify({ error: "Ticket not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Authorization
        if (!isInternal && !isAdmin && ticket.usuario_id !== callerUserId) {
          return forbidden(corsHeaders);
        }

        // Derive sender server-side. Never trust client `sender_name`.
        let remetente: "suporte" | "cliente";
        if (isInternal) {
          // Internal sync: trust provided sender_name only between known values
          remetente = body.sender_name === "suporte" ? "suporte" : "cliente";
        } else if (isAdmin) {
          remetente = "suporte";
        } else {
          remetente = "cliente";
        }

        const { error: msgError } = await supabase
          .from("suporte_mensagens").insert({
            ticket_id: ticket.id,
            mensagem: String(message).slice(0, 5000),
            remetente,
            lida: false,
          });
        if (msgError) throw new Error(`Erro ao enviar mensagem: ${msgError.message}`);

        if (ticket.status === "resolvido") {
          await supabase.from("tickets_suporte")
            .update({ status: "em_andamento", updated_at: new Date().toISOString() })
            .eq("id", ticket.id);
        }

        // Sync OUT to Trayde Tech (don't loop internal calls back out)
        if (!isInternal) {
          const TRAYDE_SUPPORT_API = "https://yblxrbmtbxtopctuuqjr.supabase.co/functions/v1/support-ticket";
          const syncToken = Deno.env.get("TRAYDE_SUPPORT_SYNC_TOKEN") || "";
          try {
            await fetch(TRAYDE_SUPPORT_API, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(syncToken ? { "x-internal-sync-token": syncToken } : {}),
              },
              body: JSON.stringify({
                action: "send_message",
                ticket_number,
                sender_name: remetente,
                message,
              }),
            });
          } catch (e) {
            console.error("trayde sync error:", e);
          }
        }

        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create ticket — authenticated users only
      if (caller.kind !== "user" && !isInternal) return unauthorized(corsHeaders);

      const tipo = body.tipo || body.subject || "";
      const descricao = body.descricao || body.description || "";
      const prioridade = body.prioridade || body.priority || "media";
      // Derive owner server-side from JWT for non-internal calls
      const usuario_email = isInternal
        ? (body.usuario_email || body.client_email || "")
        : (callerEmail || "");
      const usuario_id = isInternal
        ? (body.usuario_id || null)
        : callerUserId;
      const userName = body.userName || body.client_name || "";
      const clientSystem = body.clientSystem || body.client_system || "";
      const anexo_base64 = body.anexo_base64 || null;
      const anexo_nome = body.anexo_nome || null;

      const now = new Date();
      const ticketNumber = `SUP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets_suporte").insert({
          numero_ticket: ticketNumber,
          tipo, descricao, usuario_email, usuario_id,
          status: "aberto",
        }).select().single();

      if (ticketError) throw new Error(`Erro ao criar ticket: ${ticketError.message}`);

      let anexoUrl: string | null = null;
      if (anexo_base64 && anexo_nome) {
        try {
          const base64Data = anexo_base64.split(",")[1] || anexo_base64;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

          const sanitizedName = anexo_nome
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9._-]/g, "_");
          const filePath = `${ticket.id}/${sanitizedName}`;
          const { error: uploadError } = await supabase.storage
            .from("suporte-anexos")
            .upload(filePath, bytes, { contentType: "image/png", upsert: true });

          if (!uploadError) {
            anexoUrl = await signAttachment(filePath);
          } else {
            console.error("Erro no upload:", uploadError);
          }
        } catch (e) {
          console.error("Erro no upload:", e);
        }
      }

      if (traydeUrl && traydeKey) {
        try {
          const trayde = createClient(traydeUrl, traydeKey);
          const { error: traydeError } = await trayde.from("support_tickets").insert({
            ticket_number: ticketNumber,
            subject: tipo,
            description: descricao + (anexoUrl ? `\n\nAnexo: ${anexoUrl}` : ""),
            client_email: usuario_email,
            client_name: userName || "",
            client_system: clientSystem || "",
            priority: prioridade || "media",
            status: "aberto",
          });
          if (traydeError) console.error("Erro Trayde insert:", traydeError.message);
        } catch (e) {
          console.error("Erro ao sincronizar com Trayde Tech:", e);
        }
      }

      return new Response(JSON.stringify({ success: true, ticket_number: ticketNumber }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── PATCH (admin only) ────────────────────────────────────────────────
    if (req.method === "PATCH") {
      if (!isAdmin && !isInternal) return forbidden(corsHeaders);
      const body = await req.json();
      const { ticket_number, status, response } = body;

      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (response) updateData.resposta = response;
      if (status === "resolvido") updateData.resolvido_em = new Date().toISOString();
      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase.from("tickets_suporte")
        .update(updateData).eq("numero_ticket", ticket_number);
      if (error) throw new Error(`Erro ao atualizar ticket: ${error.message}`);

      if (!isInternal) {
        const TRAYDE_SUPPORT_API = "https://yblxrbmtbxtopctuuqjr.supabase.co/functions/v1/support-ticket";
        const syncToken = Deno.env.get("TRAYDE_SUPPORT_SYNC_TOKEN") || "";
        try {
          await fetch(TRAYDE_SUPPORT_API, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(syncToken ? { "x-internal-sync-token": syncToken } : {}),
            },
            body: JSON.stringify({ ticket_number, status, response }),
          });
        } catch (e) {
          console.error("trayde sync error:", e);
        }
      }

      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
