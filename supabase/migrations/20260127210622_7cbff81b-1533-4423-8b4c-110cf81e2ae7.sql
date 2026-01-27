-- Adicionar coluna de data de nascimento na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN birth_date date;