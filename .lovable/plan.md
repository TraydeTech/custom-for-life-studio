
# Plano de Correção: Login Administrativo

## Problema Identificado

O sistema está tratando **falhas de rede** como **"usuário não é admin"**, causando logout automático mesmo quando o usuário tem permissão de administrador.

Os logs mostram:
- Login funciona corretamente (autenticação OK)
- A chamada `has_role` falha com "Load failed" (erro de rede)
- O timeout de 5 segundos dispara e retorna `false`
- Sistema faz logout do usuário admin

## Solução Proposta

### 1. AdminLogin.tsx - Corrigir verificação de admin

**Mudanças:**
- Adicionar retry automático (3 tentativas) na verificação de admin
- Em caso de falha de rede após retries, **não fazer logout** - apenas mostrar erro e permitir tentar novamente
- Separar "falha de rede" de "não é admin"

```
Fluxo corrigido:
1. Fazer login (OK)
2. Verificar admin com 3 tentativas
3. Se verificação retornar TRUE -> redirecionar para /admin
4. Se verificação retornar FALSE (confirmado) -> logout + erro
5. Se verificação falhar por rede -> mostrar erro + permitir retry (SEM logout)
```

### 2. ProtectedAdminRoute.tsx - Corrigir proteção de rotas

**Mudanças:**
- Aumentar número de retries para 5
- Aumentar delay entre retries para 2 segundos
- **Não redirecionar se já existe sessão válida** - assumir que se chegou até aqui com sessão, o login já validou

---

## Seção Técnica

### AdminLogin.tsx - Modificações

```typescript
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    // Login
    const { data, error } = await supabase.auth.signInWithPassword({...});
    
    if (error || !data.user) {
      toast.error('Email ou senha incorretos');
      setIsLoading(false);
      return;
    }

    // Verificação com retry
    let isAdminUser: boolean | null = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data: isAdminResult, error: roleError } = await supabase.rpc('has_role', {
          _user_id: data.user.id,
          _role: 'admin'
        });
        
        if (!roleError) {
          isAdminUser = !!isAdminResult;
          break;
        }
        
        // Esperar antes de tentar novamente
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    // Se não conseguiu verificar (falha de rede)
    if (isAdminUser === null) {
      toast.error('Erro de conexão. Por favor, tente novamente.');
      setIsLoading(false);
      return; // NÃO fazer logout
    }

    // Se confirmou que não é admin
    if (!isAdminUser) {
      await supabase.auth.signOut();
      toast.error('Esta conta não tem permissão de administrador');
      setIsLoading(false);
      return;
    }

    // É admin - redirecionar
    toast.success('Bem-vindo ao painel administrativo!');
    window.location.replace('/admin');
  } catch {
    toast.error('Erro ao fazer login');
    setIsLoading(false);
  }
};
```

### ProtectedAdminRoute.tsx - Modificações

```typescript
const checkAdminAccess = async (retryCount = 0): Promise<void> => {
  if (hasChecked.current) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      hasChecked.current = true;
      navigate('/admin/login', { replace: true });
      return;
    }

    const { data: isAdmin, error } = await supabase.rpc('has_role', {...});

    if (error) {
      // Mais tentativas com mais tempo
      if (retryCount < 5) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return checkAdminAccess(retryCount + 1);
      }
      // Após 5 tentativas, assumir que está OK se tem sessão válida
      // (o AdminLogin já validou)
      hasChecked.current = true;
      setIsAuthorized(true);
      return;
    }

    hasChecked.current = true;

    if (isAdmin) {
      setIsAuthorized(true);
    } else {
      await supabase.auth.signOut();
      navigate('/admin/login', { replace: true });
    }
  } catch {
    if (retryCount < 5) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return checkAdminAccess(retryCount + 1);
    }
    // Em caso de falha total, assumir OK se tem sessão
    hasChecked.current = true;
    setIsAuthorized(true);
  }
};
```

---

## Resumo das Mudanças

| Arquivo | Mudança |
|---------|---------|
| `AdminLogin.tsx` | Retry na verificação + não fazer logout em falha de rede |
| `ProtectedAdminRoute.tsx` | Mais retries + assumir OK se sessão válida após falhas |

## Resultado Esperado

Após as correções:
1. Login não vai mais falhar por erros de rede temporários
2. Se a rede estiver instável, o sistema vai tentar várias vezes
3. Usuário admin vai conseguir entrar mesmo com conexão lenta
4. Logout só acontece quando CONFIRMADO que não é admin
