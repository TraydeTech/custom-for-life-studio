-- Permitir que usuários criem seu próprio perfil (caso não exista)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);