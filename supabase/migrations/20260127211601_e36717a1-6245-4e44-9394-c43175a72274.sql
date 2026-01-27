-- Adicionar coluna de CNPJ na tabela profiles para pessoa jurídica
ALTER TABLE public.profiles 
ADD COLUMN cnpj text,
ADD COLUMN company_name text,
ADD COLUMN person_type text DEFAULT 'fisica';