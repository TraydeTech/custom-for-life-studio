
# Plano: Otimização do Sistema de Gestão de Estoque e Custos

## Resumo Executivo

Após analisar o sistema atual, proponho uma estrutura otimizada onde cada página tem seu foco específico, evitando duplicação de informações e criando uma experiência mais organizada.

## Estrutura Proposta

```text
+----------------------------------+----------------------------------+
|           PRODUTOS               |          FORNECEDORES            |
|  (Visão Geral do Inventário)     |    (Análise por Parceiro)        |
+----------------------------------+----------------------------------+
| - Dashboard geral do estoque     | - Dados cadastrais               |
| - Total Custo (todo estoque)     | - Custo/Venda POR fornecedor     |
| - Total Venda (todo estoque)     | - Qtd produtos por fornecedor    |
| - Lucro Potencial TOTAL          | - Análise de investimento        |
| - Produtos sem fornecedor        |   em cada parceiro               |
| - Margem por produto             |                                  |
+----------------------------------+----------------------------------+
```

## Mudancas em Produtos

### 1. Dashboard de Inventario Geral (novo)
Adicionar cards no topo da pagina de Produtos com:

- **Valor Total em Custo**: Soma de (custo x estoque) de TODOS os produtos
- **Valor Total em Venda**: Soma de (preco x estoque) de TODOS os produtos  
- **Lucro Potencial**: Diferenca entre venda e custo com percentual de margem
- **Produtos sem Fornecedor**: Alerta mostrando quantos produtos nao estao vinculados

### 2. Coluna de Margem na Tabela de Produtos
Adicionar coluna "Margem" na listagem mostrando:
- Percentual de lucro de cada produto: ((preco - custo) / custo) x 100
- Cor verde para margem maior que 30%
- Cor amarela para margem entre 15% e 30%
- Cor vermelha para margem menor que 15%

### 3. Indicador Visual de Preco de Custo
Na tabela de produtos, mostrar o preco de custo junto ao preco de venda em texto menor

## Mudancas em Fornecedores

### 1. Manter Dashboard Atual (sem alteracao)
O dashboard de fornecedores continua focado na analise por parceiro comercial:
- Total investido com cada fornecedor
- Valor potencial de venda por fornecedor
- Quantidade de produtos por fornecedor

### 2. Pequena Melhoria: Link para Produtos
Ao clicar na quantidade de produtos de um fornecedor, filtrar a pagina de produtos para mostrar apenas os itens daquele fornecedor

## Detalhes Tecnicos

### Arquivo: src/pages/admin/Produtos.tsx

**Novas dependencias**:
- Importar Card, CardContent, CardHeader, CardTitle de @/components/ui/card
- Importar icones: DollarSign, TrendingUp, Package, AlertTriangle
- Importar useMemo de react

**Nova query para calculos**:
```typescript
const inventoryStats = useMemo(() => {
  if (!products) return { totalCost: 0, totalSale: 0, profit: 0, noSupplier: 0 };
  
  const totalCost = products.reduce((sum, p) => 
    sum + ((p.cost_price || 0) * (p.stock || 0)), 0);
  const totalSale = products.reduce((sum, p) => 
    sum + ((p.price || 0) * (p.stock || 0)), 0);
  const noSupplier = products.filter(p => !p.supplier_id).length;
  
  return {
    totalCost,
    totalSale,
    profit: totalSale - totalCost,
    noSupplier,
  };
}, [products]);
```

**Dashboard (4 cards)**:
- Total em Custo (valor de compra do estoque)
- Total em Venda (valor potencial de venda)
- Lucro Potencial (com percentual de margem)
- Sem Fornecedor (alerta se houver produtos sem vinculo)

**Nova coluna na tabela**:
- Adicionar "Custo" e "Margem" entre "Preco" e "Estoque"
- Calcular margem: ((preco - custo) / custo) * 100
- Aplicar cores condicionais baseadas no percentual

### Arquivo: src/pages/admin/Fornecedores.tsx

**Pequeno ajuste**:
- Remover o dashboard global (Total em Custo, Total em Venda, Lucro Potencial)
- Manter apenas os dados por fornecedor na tabela
- Adicionar link na coluna "Produtos" para filtrar por fornecedor

Alternativa: Manter como esta se preferir ter a visao duplicada em ambos os lugares

## Resumo Visual

```text
ANTES (atual):
- Fornecedores: Dashboard geral + dados por fornecedor
- Produtos: Apenas lista de produtos

DEPOIS (otimizado):
- Fornecedores: Apenas dados por fornecedor (foco no parceiro)
- Produtos: Dashboard geral + lista com margem (foco no inventario)
```

## Beneficios

1. **Clareza**: Cada pagina tem seu proposito definido
2. **Consistencia**: Dashboard de inventario fica onde faz mais sentido (Produtos)
3. **Visibilidade**: Margem de lucro visivel diretamente na listagem
4. **Alertas**: Identificacao rapida de produtos sem fornecedor
5. **Navegacao**: Link direto de fornecedor para seus produtos

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| src/pages/admin/Produtos.tsx | Adicionar dashboard + colunas de custo/margem |
| src/pages/admin/Fornecedores.tsx | Opcional: remover dashboard global duplicado |

