

## Diagnóstico: Tickets não chegam ao Trayde Tech

### Problemas Identificados

**Problema 1: O erro do insert no Trayde Tech é silencioso**

O Supabase client JavaScript **não lança exceção** quando um `.insert()` falha -- ele retorna `{ data, error }` no objeto de resposta. O código atual faz:

```text
await trayde.from("support_tickets").insert({ ... });
```

Sem capturar o `{ error }` retornado, qualquer falha (RLS, tabela inexistente, coluna errada, URL/chave incorreta) é **completamente ignorada**. O `try-catch` só captura erros de rede/exceções, não erros do Supabase.

**Problema 2: Valor do secret TRAYDE_SUPABASE_URL pode estar incorreto**

Os logs mostram que antes da correção, o erro era "Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL", indicando que o valor do secret não continha `https://`. Embora o código agora adicione o prefixo, o valor armazenado pode estar em formato incorreto (ex: só o project ref em vez da URL completa).

A URL correta deve ser: `https://yblxrbmtbxtopctuuqjr.supabase.co`

### Plano de Correção

**Passo 1: Atualizar a Edge Function com logging e verificação de erro**

Modificar `supabase/functions/support-ticket/index.ts` para:
- Adicionar `console.log` para mostrar se `traydeUrl` e `traydeKey` estão configurados (sem expor os valores)
- Capturar o `{ data, error }` retornado pelo `.insert()` do Trayde
- Logar o erro se houver falha na inserção

Trecho corrigido:
```text
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
        description: descricao + (anexoUrl ? "\n\nAnexo: " + anexoUrl : ""),
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
```

**Passo 2: Atualizar o secret TRAYDE_SUPABASE_URL**

Solicitar que você confirme/atualize o valor do secret `TRAYDE_SUPABASE_URL` para a URL completa:
`https://yblxrbmtbxtopctuuqjr.supabase.co`

**Passo 3: Re-deploy e testar**

Após as correções, enviar um ticket de teste e verificar os logs para confirmar que a sincronização funciona.

### Detalhes Técnicos

Arquivo modificado: `supabase/functions/support-ticket/index.ts`
- Adicionar destructuring `{ data, error }` no insert do Trayde
- Adicionar logs de diagnóstico
- Adicionar log de aviso quando secrets não estão configurados
- Solicitar atualização do secret TRAYDE_SUPABASE_URL

