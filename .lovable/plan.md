
# Plano de melhorias — Custom For Life Studio

Execução em 4 fases. Cada fase é independente e pode ser entregue/validada antes de seguir. Frete real fica fora deste plano (será feito depois, conforme sua decisão).

---

## Fase 1 — Segurança e integridade (Alta prioridade)

### 1.1 Admin protegido sem race condition
**Arquivos:** `src/components/admin/ProtectedAdminRoute.tsx`, `src/contexts/AuthContext.tsx`

- Remover o timeout fixo de 1.5s usado para decidir se o usuário é admin.
- Introduzir três estados explícitos: `loading` (sessão ou role ainda carregando), `unauthorized` (não logado), `forbidden` (logado mas sem role admin), `allowed`.
- Enquanto estiver em `loading`, renderizar apenas um skeleton/spinner — nunca o conteúdo administrativo.
- Buscar a role via `has_role` RPC sem corrida com Promise.race; tratar erro de rede repetindo com backoff curto, mas nunca caindo para `allowed` em caso de falha.
- `unauthorized` → redirecionar para `/admin/login`. `forbidden` → redirecionar para `/` com toast de acesso negado.
- Manter compatibilidade com o memory `admin-auth-immutable`: não alterar a tela de login do admin, apenas a guarda de rota e o trecho do AuthContext que define `isAdmin`/`adminChecked`.

### 1.2 Validação real de CPF no checkout
**Arquivos:** `src/pages/Checkout.tsx`, novo `src/lib/cpf.ts`

- Criar utilitário `src/lib/cpf.ts` com:
  - `maskCPF(value)` aplicando formato `000.000.000-00`.
  - `unmaskCPF(value)` removendo não dígitos.
  - `isValidCPF(value)` validando dígitos verificadores e rejeitando sequências repetidas.
- Aplicar máscara no input de CPF do checkout (onChange).
- Validar com Zod + `isValidCPF` antes de prosseguir para pagamento; bloquear avanço com mensagem amigável.
- Enviar somente CPF normalizado (apenas dígitos) para a Edge Function `create-payment` / Iugu.
- Reaproveitar o utilitário no cadastro (`RegisterForm.tsx`) e em `MinhaConta.tsx`/`useProfile.ts` se já houver campo CPF.

### 1.3 E-mail de confirmação de pedido (Lovable Emails)
**Arquivos:** infra de email + nova Edge Function `send-order-confirmation` + chamada após pagamento

- Provisionar infraestrutura de e-mail via Lovable Emails (domínio remetente; setup automático no app).
- Criar Edge Function transacional `send-order-confirmation` enfileirando e-mail para o cliente com:
  - Número do pedido, nome do cliente, itens (com cor/gravação), subtotal, frete, total, endereço de entrega, forma de pagamento e status inicial.
- Disparar a função em dois pontos seguros:
  - No webhook da Iugu (`iugu-webhook`) quando o pedido vira `paid` — momento canônico de confirmação.
  - No PDV (admin) ao criar pedido já pago.
- Falha de e-mail nunca deve cancelar o pedido: capturar erro, registrar no log da função, retornar sucesso ao webhook.
- Template seguindo a identidade visual (verde #1D9E75, âmbar #EF9F27, fundo branco do corpo).

---

## Fase 2 — Confiabilidade comercial (Média prioridade)

### 2.1 Parcelamento 12x — centralizar regra
**Arquivos:** novo `src/lib/installments.ts`, `src/pages/Produto.tsx`, `src/pages/Checkout.tsx`, `src/pages/Carrinho.tsx`

- Criar constante única:
  ```ts
  export const INSTALLMENT_CONFIG = {
    maxInstallments: 12,
    interestFreeUpTo: 12,
    minInstallmentValue: 5,
  };
  ```
- Função utilitária `getInstallmentText(price)` reaproveitada em produto, carrinho e checkout, garantindo texto idêntico em toda a jornada.
- Usar a mesma constante para gerar `installmentOptions` no Checkout (onde hoje está hardcoded `length: 12`).

### 2.2 Slug único de produto
**Arquivos:** migração SQL + `src/pages/admin/Produtos.tsx`

- Migração: `CREATE UNIQUE INDEX products_slug_key ON public.products (slug);` (com tratamento prévio caso já existam duplicados — checar e renomear no script).
- No formulário admin: ao salvar, consultar `products` por slug ignorando o próprio id; bloquear com mensagem "Slug já em uso" e sugerir alternativa (`slug-2`, `slug-3`).
- Tratar o erro `23505` da constraint com toast amigável.

### 2.3 Paginação real na loja
**Arquivos:** `src/pages/Loja.tsx`

- Carregar 12 produtos por página com `range(from, to)` do Supabase, preservando filtros de categoria/busca/ordenação atuais.
- Usar `useInfiniteQuery` do React Query com botão "Carregar mais" no estilo atual.
- Mostrar loading inline e estado "Você chegou ao fim do catálogo".
- Garantir `count: 'exact'` apenas quando necessário (ex.: para o badge de total).

---

## Fase 3 — Qualidade de experiência (Média/Baixa)

### 3.1 Drag de gravação no iOS Safari
**Arquivos:** `src/pages/Produto.tsx` (canvas inline)

- Migrar handlers para Pointer Events (`onPointerDown/Move/Up/Cancel`) com `setPointerCapture`.
- Adicionar `style={{ touchAction: 'none' }}` no canvas (já existe parcialmente — confirmar).
- Chamar `e.preventDefault()` no `pointermove` enquanto estiver arrastando para evitar scroll do iOS.
- Tratar `pointercancel` (iOS dispara em rolagem/gestos) resetando estado de drag.
- Validar que cliques curtos continuam abrindo o zoom em desktop.

### 3.2 Remover ProductImageCanvas.tsx morto
**Arquivos:** `src/components/shop/ProductImageCanvas.tsx`

- Confirmação por busca: o componente é apenas auto-referenciado, não importado em lugar nenhum.
- Excluir o arquivo. Build deve continuar passando.

---

## Fase 4 — Cadastro e verificação de e-mail (Baixa)

### 4.1 Fluxo de verificação de e-mail no signup
**Arquivos:** `src/components/auth/RegisterForm.tsx`, `src/pages/Login.tsx`

- Garantir `emailRedirectTo: \`${window.location.origin}/\`` no `signUp` (já existe — auditar).
- Após signup, exibir mensagem clara: "Enviamos um e-mail de confirmação. Verifique sua caixa de entrada antes de fazer login." (caso a confirmação esteja ativa).
- No login, tratar erro `Email not confirmed` exibindo aviso amigável + botão "Reenviar e-mail de confirmação".
- Adicionar comentário no código indicando que o comportamento depende da configuração de auto-confirm em Lovable Cloud → Auth.

> Observação: hoje o memory `auth-configuration-settings` indica auto-confirm ligado. A implementação acima fica preparada para quando o auto-confirm for desligado, sem quebrar o fluxo atual.

---

## Detalhes técnicos

### Migrações SQL necessárias
```sql
-- Fase 2.2: slug único
-- (Antes, script para verificar duplicatas e renomear se houver)
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products (slug);
```

### Edge Functions
- **Nova:** `send-order-confirmation` (transacional via Lovable Emails).
- **Modificada:** `iugu-webhook` — disparar `send-order-confirmation` após mudar status para `paid`.

### Arquivos novos
- `src/lib/cpf.ts`
- `src/lib/installments.ts`
- `supabase/functions/send-order-confirmation/index.ts`
- Templates em `supabase/functions/_shared/email-templates/order-confirmation.tsx`

### Arquivos alterados
- `src/components/admin/ProtectedAdminRoute.tsx`
- `src/contexts/AuthContext.tsx`
- `src/pages/Checkout.tsx`
- `src/pages/Carrinho.tsx`
- `src/pages/Produto.tsx`
- `src/pages/Loja.tsx`
- `src/pages/admin/Produtos.tsx`
- `src/components/auth/RegisterForm.tsx`
- `src/pages/Login.tsx`
- `supabase/functions/iugu-webhook/index.ts`

### Arquivos removidos
- `src/components/shop/ProductImageCanvas.tsx`

---

## Configurações externas necessárias
- **Lovable Emails:** configurar domínio remetente (etapa única, feita pelo dialog de setup).
- **Iugu:** confirmar no painel que o parcelamento até 12x está com juros absorvidos pela loja (você já validou — apenas registrar).
- **Supabase Auth:** decidir se mantém auto-confirm ligado ou exige verificação por e-mail (o código suportará ambos).

## Como testar cada fase
- **1.1:** logar como user comum e tentar `/admin` → deve redirecionar; logar como admin → conteúdo só aparece após confirmação, sem flicker.
- **1.2:** digitar `111.111.111-11` no checkout → bloqueio; CPF válido → avança.
- **1.3:** finalizar pedido de teste com pagamento confirmado → cliente recebe e-mail de confirmação.
- **2.1:** texto "12x sem juros" idêntico em produto, carrinho e checkout, vindo da mesma fonte.
- **2.2:** tentar criar dois produtos com mesmo slug → bloqueio amigável.
- **2.3:** loja carrega 12 itens; "Carregar mais" busca os próximos 12 sem duplicar.
- **3.1:** abrir produto no iPhone Safari → arrastar texto da gravação sem scroll da página.
- **3.2:** build passa sem o componente removido.
- **4.1:** signup com auto-confirm desligado → mensagem clara; login com e-mail não confirmado → aviso + reenvio.
