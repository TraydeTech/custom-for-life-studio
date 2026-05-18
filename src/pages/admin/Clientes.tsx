import { CRUDModule } from '@/components/admin/CRUDModule';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { User } from 'lucide-react';

type Profile = Tables<'profiles'>;

export default function AdminClientes() {
  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <CRUDModule<Profile>
          title="Clientes"
          tableName="profiles"
          queryKey="admin-customers"
          searchPlaceholder="Buscar por nome, telefone ou CPF..."
          searchFields={['full_name', 'phone', 'cpf', 'email']}
          initialData={{
            full_name: '',
            email: '',
            phone: '',
            cpf: '',
            cnpj: '',
            company_name: '',
          }}
          columns={[
            { 
              header: 'Cliente', 
              key: 'full_name',
              render: (val) => (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  {val || 'Sem nome'}
                </div>
              )
            },
            { header: 'E-mail', key: 'email' },
            { 
              header: 'Telefone', 
              key: 'phone',
              render: (val) => val ? val.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : '-'
            },
            { 
              header: 'CPF/CNPJ', 
              key: 'cpf',
              render: (_, item) => item.cpf || item.cnpj || '-'
            },
          ]}
          formFields={[
            { label: 'Nome Completo', key: 'full_name', required: true },
            { label: 'E-mail', key: 'email', type: 'email', required: true },
            { label: 'Telefone', key: 'phone' },
            { label: 'CPF', key: 'cpf' },
            { label: 'CNPJ', key: 'cnpj' },
            { label: 'Razão Social (PJ)', key: 'company_name' },
          ]}
        />
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
