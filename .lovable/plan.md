

## Sistema de Comunicacao Bidirecional de Tickets

Hoje o fluxo e apenas de ida: o cliente abre o chamado e voce recebe no Trayde Tech. Mas nao existe um caminho de volta -- quando voce responde, o cliente nao ve nada. Vamos criar esse caminho de volta completo.

### Como vai funcionar

1. **Voce responde no Trayde Tech** -- o Trayde Tech chama uma Edge Function (webhook) no sistema do cliente para atualizar o ticket
2. **O cliente ve os tickets dele** -- uma nova pagina "Meus Chamados" na area da conta do cliente mostra todos os tickets, status e respostas
3. **O cliente pode enviar novas mensagens** -- dentro de um ticket aberto, o cliente pode continuar a conversa
4. **Atualizacoes em tempo real** -- o cliente ve as respostas sem precisar atualizar a pagina

### O que sera criado

**1. Nova Edge Function: `sync-ticket-response`**
- Webhook que o Trayde Tech chama quando voce responde um chamado
- Recebe: numero do ticket, resposta, novo status
- Atualiza a tabela `tickets_suporte` com a resposta e status
- Insere a mensagem na tabela `suporte_mensagens`

**2. Nova pagina: "Meus Chamados" (`/minha-conta/chamados`)**
- Lista todos os tickets do cliente logado com status (Aberto, Em andamento, Resolvido)
- Ao clicar em um ticket, abre o historico de mensagens
- O cliente pode enviar novas mensagens em tickets abertos
- Indicador visual de mensagens nao lidas

**3. Atualizar o Widget de Suporte**
- Apos enviar ticket, mostrar link para "Acompanhar meus chamados"
- Manter a funcionalidade atual de abertura

**4. Menu da conta do cliente**
- Adicionar "Meus Chamados" no menu lateral da area do cliente (ao lado de Pedidos e Enderecos)

**5. Atualizar a Edge Function `support-ticket` existente**
- Ao cliente enviar nova mensagem, sincronizar com Trayde Tech tambem

**6. Ativar Realtime na tabela `suporte_mensagens`**
- Para que o cliente veja respostas em tempo real sem recarregar a pagina

### Detalhes Tecnicos

**Banco de dados:**
- Ativar realtime na tabela `suporte_mensagens`
- As tabelas `tickets_suporte` e `suporte_mensagens` ja existem com as colunas necessarias

**Nova Edge Function `sync-ticket-response/index.ts`:**
- Endpoint PATCH que recebe `{ ticket_number, status, response, responder_name }`
- Atualiza `tickets_suporte.status` e `tickets_suporte.resposta`
- Insere em `suporte_mensagens` com `remetente = "suporte"`
- Protegida por chave de API para que apenas o Trayde Tech possa chamar

**Nova pagina `src/pages/MeusChamados.tsx`:**
- Usa `AccountLayout` existente
- Query: `supabase.from('tickets_suporte').select('*').eq('usuario_id', user.id)`
- Ao abrir ticket: `supabase.from('suporte_mensagens').select('*').eq('ticket_id', ticketId)`
- Formulario para enviar nova mensagem
- Realtime subscription para novas mensagens

**Arquivos modificados:**
- `src/components/account/AccountLayout.tsx` -- adicionar item "Meus Chamados" no menu
- `src/App.tsx` -- adicionar rota `/minha-conta/chamados`
- `src/components/support/SupportWidget.tsx` -- adicionar link para acompanhar chamados

**Arquivos criados:**
- `src/pages/MeusChamados.tsx` -- pagina completa de chamados
- `supabase/functions/sync-ticket-response/index.ts` -- webhook para respostas

**Configuracao no Trayde Tech:**
- Voce precisara configurar no Trayde Tech um webhook que chame a URL da Edge Function `sync-ticket-response` sempre que responder um chamado

