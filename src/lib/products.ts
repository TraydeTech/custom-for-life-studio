/**
 * Colunas de `products` seguras para leitura pública (visitante anônimo).
 *
 * `cost_price` e `supplier_id` são internos (margem/fornecedor) e o banco
 * revoga o SELECT dessas colunas para o papel `anon`. Por isso as páginas
 * públicas NÃO podem usar `select('*')` — isso dispara
 * "permission denied for column cost_price". Use esta lista no lugar.
 *
 * O painel admin (papel `authenticated` com role admin) continua lendo as
 * colunas sensíveis normalmente via `select('*')`.
 */
export const PUBLIC_PRODUCT_COLUMNS = 'id, name, slug, description, short_description, price, compare_price, images, category_id, stock, min_quantity, is_active, is_featured, customization_options, specifications, created_at, updated_at' as const;
