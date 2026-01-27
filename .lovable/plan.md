
# Plano: Adicionar Validação Completa do CPF

## Objetivo
Implementar validação completa do CPF com verificação dos dígitos verificadores para garantir que apenas números válidos estruturalmente sejam aceitos no formulário de cadastro.

## Como Funciona a Validação do CPF

O CPF brasileiro possui 11 dígitos, sendo os dois últimos os dígitos verificadores. A validação segue um algoritmo matemático específico:

1. **Primeiro dígito verificador**: Calculado multiplicando os 9 primeiros dígitos por pesos decrescentes (10 a 2), somando e aplicando módulo 11
2. **Segundo dígito verificador**: Calculado multiplicando os 10 primeiros dígitos por pesos decrescentes (11 a 2), somando e aplicando módulo 11

---

## Alterações Planejadas

### Arquivo: `src/components/auth/RegisterForm.tsx`

**1. Criar função de validação do CPF**

Adicionar uma função `validateCpf` que:
- Remove caracteres não numéricos
- Verifica se tem exatamente 11 dígitos
- Rejeita CPFs com todos os dígitos iguais (ex: 111.111.111-11)
- Calcula e valida o primeiro dígito verificador
- Calcula e valida o segundo dígito verificador

**2. Atualizar o schema Zod**

Modificar a validação do campo `cpf` no `fisicaSchema` para usar `.refine()` com a função de validação, exibindo mensagem de erro específica quando o CPF for inválido.

**3. Adicionar feedback visual em tempo real**

Adicionar validação no `onChange` do campo CPF para mostrar feedback visual quando o CPF completo é digitado e é inválido.

---

## Detalhes Técnicos

```text
Função validateCpf(cpf: string): boolean

1. Limpar CPF (remover . e -)
2. Se length != 11 → retorna false
3. Se todos dígitos iguais → retorna false
4. Calcular 1º dígito:
   - soma = Σ(cpf[i] × (10-i)) para i=0..8
   - resto = soma % 11
   - d1 = resto < 2 ? 0 : 11 - resto
5. Calcular 2º dígito:
   - soma = Σ(cpf[i] × (11-i)) para i=0..9
   - resto = soma % 11
   - d2 = resto < 2 ? 0 : 11 - resto
6. Comparar d1 e d2 com dígitos 10 e 11 do CPF
```

---

## Experiência do Usuário

- **Mensagem de erro clara**: "CPF inválido. Verifique os números digitados."
- **Validação ao digitar**: Quando o CPF completo (14 caracteres com máscara) é digitado, valida imediatamente
- **Indicador visual**: Campo fica com borda vermelha se inválido após preenchimento completo
- **Validação no submit**: Também valida antes de enviar o formulário
