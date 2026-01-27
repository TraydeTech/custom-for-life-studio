-- Adicionar campos completos ao cadastro de fornecedores
ALTER TABLE public.suppliers
ADD COLUMN cpf TEXT,
ADD COLUMN cnpj TEXT,
ADD COLUMN zip_code TEXT,
ADD COLUMN street TEXT,
ADD COLUMN number TEXT,
ADD COLUMN complement TEXT,
ADD COLUMN neighborhood TEXT,
ADD COLUMN city TEXT,
ADD COLUMN state TEXT;