-- Tabela de contas a receber
CREATE TABLE public.accounts_receivable (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    customer_name TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de contas a pagar
CREATE TABLE public.accounts_payable (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    supplier_name TEXT,
    category TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

-- Policies para accounts_receivable (apenas admins)
CREATE POLICY "Admins can manage accounts_receivable" 
ON public.accounts_receivable 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies para accounts_payable (apenas admins)
CREATE POLICY "Admins can manage accounts_payable" 
ON public.accounts_payable 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_accounts_receivable_updated_at
BEFORE UPDATE ON public.accounts_receivable
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_payable_updated_at
BEFORE UPDATE ON public.accounts_payable
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar conta a receber automaticamente quando um pedido é criado
CREATE OR REPLACE FUNCTION public.create_receivable_from_order()
RETURNS TRIGGER AS $$
DECLARE
    customer_name_val TEXT;
BEGIN
    -- Buscar nome do cliente se existir user_id
    IF NEW.user_id IS NOT NULL THEN
        SELECT full_name INTO customer_name_val
        FROM public.profiles
        WHERE user_id = NEW.user_id;
    END IF;
    
    -- Se não encontrou nome, usa o do endereço de entrega
    IF customer_name_val IS NULL THEN
        customer_name_val := NEW.shipping_address->>'name';
    END IF;
    
    -- Criar conta a receber
    INSERT INTO public.accounts_receivable (
        description,
        amount,
        due_date,
        status,
        order_id,
        customer_name,
        notes
    ) VALUES (
        'Pedido ' || NEW.order_number || ' - ' || COALESCE(NEW.source, 'site'),
        NEW.total,
        CURRENT_DATE + INTERVAL '30 days',
        CASE 
            WHEN NEW.payment_status = 'paid' THEN 'paid'
            ELSE 'pending'
        END,
        NEW.id,
        customer_name_val,
        'Origem: ' || UPPER(COALESCE(NEW.source, 'site'))
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para criar conta a receber quando pedido é criado
CREATE TRIGGER create_receivable_on_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_receivable_from_order();

-- Função para atualizar status da conta quando pagamento é confirmado
CREATE OR REPLACE FUNCTION public.update_receivable_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o status de pagamento mudou para 'paid'
    IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
        UPDATE public.accounts_receivable
        SET status = 'paid', paid_date = CURRENT_DATE
        WHERE order_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para atualizar conta quando pagamento é confirmado
CREATE TRIGGER update_receivable_on_order_payment
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_receivable_on_payment();