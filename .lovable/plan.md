
## Adicionar Gestao de Chamados no Painel Administrativo

O sistema de chamados foi criado apenas na area do cliente. Falta a parte do admin para voce poder ver e gerenciar os tickets diretamente pelo painel.

### O que sera criado

**1. Nova pagina: Chamados (`/admin/chamados`)**
- Lista todos os tickets de suporte de todos os clientes
- Filtros por status (Aberto, Em andamento, Resolvido)
- Ao clicar em um ticket, abre o historico completo de mensagens
- Campo para responder diretamente ao cliente
- Botao para alterar o status do ticket (marcar como resolvido, em andamento, etc.)
- Exibicao do nome/email do cliente que abriu o chamado

**2. Atualizar o menu lateral do admin**
- Adicionar item "Chamados" no `AdminSidebar` com icone de `MessageCircle`
- Badge com contagem de tickets abertos/pendentes (similar ao badge de pedidos)

**3. Nova rota no App**
- Registrar `/admin/chamados` no roteamento

### Detalhes Tecnicos

**Arquivo novo: `src/pages/admin/Chamados.tsx`**
- Layout usando `AdminLayout` existente
- Query: `supabase.from('tickets_suporte').select('*, profiles(full_name)')` para listar todos os tickets com nome do cliente
- Mensagens: `supabase.from('suporte_mensagens').select('*').eq('ticket_id', id)`
- Envio de resposta: insere em `suporte_mensagens` com `remetente = 'suporte'`
- Realtime subscription para novas mensagens

**Arquivo modificado: `src/components/admin/AdminSidebar.tsx`**
- Adicionar item `{ icon: MessageCircle, label: 'Chamados', path: '/admin/chamados', showTicketBadge: true }`
- Hook para contar tickets abertos (similar ao `usePendingOrdersCount`)

**Arquivo modificado: `src/App.tsx`**
- Adicionar rota `/admin/chamados` apontando para o novo componente

**Novo hook: `src/hooks/useOpenTicketsCount.ts`**
- Conta tickets com status `aberto` ou `em_andamento`
- Usado no badge do menu lateral

### Resultado

Voce tera um item "Chamados" no menu lateral do admin (entre Relatorios e Clientes), com badge mostrando quantos tickets estao pendentes. Ao clicar, vera a lista de todos os chamados dos clientes e podera responder diretamente, com as mensagens aparecendo em tempo real para o cliente.
