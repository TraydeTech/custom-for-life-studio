
-- Tabela tickets_suporte
CREATE TABLE public.tickets_suporte (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_ticket TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  usuario_email TEXT,
  usuario_id UUID,
  status TEXT NOT NULL DEFAULT 'aberto',
  resposta TEXT,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tickets_suporte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select tickets" ON public.tickets_suporte FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert tickets" ON public.tickets_suporte FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update tickets" ON public.tickets_suporte FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete tickets" ON public.tickets_suporte FOR DELETE USING (auth.role() = 'authenticated');

-- Tabela suporte_mensagens
CREATE TABLE public.suporte_mensagens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets_suporte(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL,
  remetente TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.suporte_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select messages" ON public.suporte_mensagens FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert messages" ON public.suporte_mensagens FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update messages" ON public.suporte_mensagens FOR UPDATE USING (auth.role() = 'authenticated');

-- Trigger updated_at para tickets_suporte
CREATE TRIGGER update_tickets_suporte_updated_at
BEFORE UPDATE ON public.tickets_suporte
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket de storage
INSERT INTO storage.buckets (id, name, public) VALUES ('suporte-anexos', 'suporte-anexos', true);

CREATE POLICY "Allow public uploads to suporte-anexos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'suporte-anexos');
CREATE POLICY "Allow public viewing of suporte-anexos" ON storage.objects FOR SELECT USING (bucket_id = 'suporte-anexos');
