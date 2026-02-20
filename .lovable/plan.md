

## Limpar Chamados de Teste do Banco de Dados

Vou remover todos os 10 chamados de teste e suas 30 mensagens associadas do banco de dados. Nenhuma alteração será feita no código ou na lógica do sistema.

### O que será removido

| Ticket | Data | Status |
|--------|------|--------|
| SUP-20260220-3792 | 20/02/2026 | Resolvido |
| SUP-20260220-4067 | 20/02/2026 | Resolvido |
| SUP-20260220-6905 | 20/02/2026 | Em andamento |
| SUP-20260218-7984 | 18/02/2026 | Aberto |
| SUP-20260218-6070 | 18/02/2026 | Aberto |
| SUP-20260218-5547 | 18/02/2026 | Aberto |
| SUP-20260218-0954 | 18/02/2026 | Aberto |
| SUP-20260218-7958 | 18/02/2026 | Aberto |
| SUP-20260218-0073 | 18/02/2026 | Aberto |
| SUP-20260218-4364 | 18/02/2026 | Aberto |

### Passos

1. Deletar todas as mensagens da tabela `suporte_mensagens` (30 mensagens)
2. Deletar todos os tickets da tabela `tickets_suporte` (10 tickets)
3. Nenhuma alteração no código -- tudo continua funcionando como antes

### Detalhes Técnicos

- As mensagens precisam ser deletadas primeiro pois referenciam os tickets
- Nenhum arquivo de código será modificado
- O sistema continuará pronto para receber novos chamados reais

