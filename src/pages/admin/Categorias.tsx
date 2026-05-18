import { CRUDModule } from '@/components/admin/CRUDModule';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';

type Category = Tables<'categories'>;

export default function AdminCategorias() {
  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <CRUDModule<Category>
          title="Categorias"
          tableName="categories"
          queryKey="admin-categories"
          searchPlaceholder="Buscar categorias..."
          searchFields={['name', 'slug']}
          initialData={{
            name: '',
            slug: '',
            description: '',
            is_active: true,
            sort_order: 0,
          }}
          columns={[
            { header: 'Ordem', key: 'sort_order' },
            { header: 'Nome', key: 'name' },
            { header: 'Slug', key: 'slug' },
            { 
              header: 'Ficha Técnica', 
              key: 'technical_sheet',
              render: (val) => (
                val && Array.isArray(val) && val.length > 0 ? (
                  <Badge variant="outline" className="text-primary gap-1">
                    <FileText className="h-3 w-3" /> Cadastrada
                  </Badge>
                ) : <span className="text-muted-foreground text-xs">—</span>
              )
            },
            { 
              header: 'Status', 
              key: 'is_active',
              render: (val) => (
                <Badge className={val ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}>
                  {val ? 'Ativa' : 'Inativa'}
                </Badge>
              )
            },
          ]}
          formFields={[
            { label: 'Nome', key: 'name', required: true, placeholder: 'Ex: Copos Térmicos' },
            { label: 'Slug', key: 'slug', placeholder: 'Ex: copos-termicos (opcional)' },
            { label: 'Descrição', key: 'description', type: 'textarea' },
            { label: 'Ordem de Exibição', key: 'sort_order', type: 'number' },
          ]}
          onBeforeSave={(data) => ({
            ...data,
            slug: data.slug || data.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, ''),
            sort_order: parseInt(data.sort_order) || 0,
          })}
        />
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
