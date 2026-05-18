import { CRUDModule } from '@/components/admin/CRUDModule';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tables } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/utils';

type Supplier = Tables<'suppliers'>;

export default function AdminFornecedores() {
  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <CRUDModule<Supplier>
          title="Fornecedores"
          tableName="suppliers"
          queryKey="admin-suppliers"
          searchPlaceholder="Buscar por nome, e-mail ou CNPJ..."
          searchFields={['name', 'email', 'cnpj', 'cpf', 'contact_name']}
          initialData={{
            name: '',
            contact_name: '',
            email: '',
            phone: '',
            cnpj: '',
            cpf: '',
            zip_code: '',
            street: '',
            number: '',
            neighborhood: '',
            city: '',
            state: '',
            notes: '',
          }}
          columns={[
            { header: 'Nome/Razão Social', key: 'name' },
            { header: 'Contato', key: 'contact_name' },
            { header: 'E-mail', key: 'email' },
            { header: 'Telefone', key: 'phone' },
            { header: 'Cidade', key: 'city' },
          ]}
          formFields={[
            { label: 'Nome / Razão Social', key: 'name', required: true },
            { label: 'Nome do Contato', key: 'contact_name' },
            { label: 'E-mail', key: 'email', type: 'email' },
            { label: 'Telefone', key: 'phone' },
            { label: 'CNPJ', key: 'cnpj' },
            { label: 'CPF', key: 'cpf' },
            { label: 'CEP', key: 'zip_code' },
            { label: 'Rua', key: 'street' },
            { label: 'Número', key: 'number' },
            { label: 'Bairro', key: 'neighborhood' },
            { label: 'Cidade', key: 'city' },
            { label: 'Estado', key: 'state' },
            { label: 'Observações', key: 'notes', type: 'textarea' },
          ]}
        />
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
