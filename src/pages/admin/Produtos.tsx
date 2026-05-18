import { useState, useRef } from 'react';
import { CRUDModule } from '@/components/admin/CRUDModule';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Package, Image as ImageIcon, Plus, X, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

type Product = Tables<'products'>;
type Category = Tables<'categories'>;

interface ColorVariant {
  id?: string;
  color_name: string;
  main_image: string;
  additional_images: string[];
  sort_order: number;
  stock: number;
}

export default function AdminProdutos() {
  const [uploadingVariant, setUploadingVariant] = useState<number | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
      return data || [];
    }
  });

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = `products/${fileName}`;
    const { error } = await supabase.storage.from('product-images').upload(filePath, file);
    if (error) throw error;
    const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleMainImageUpload = async (variantIndex: number, file: File, variants: ColorVariant[], setVariants: (v: ColorVariant[]) => void) => {
    setUploadingVariant(variantIndex);
    try {
      const url = await uploadImage(file);
      const updated = variants.map((v, i) => i === variantIndex ? { ...v, main_image: url } : v);
      setVariants(updated);
    } catch (error: any) {
      toast.error('Erro ao fazer upload: ' + error.message);
    }
    setUploadingVariant(null);
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <CRUDModule<Product>
          title="Produtos"
          tableName="products"
          queryKey="admin-products"
          searchPlaceholder="Buscar produtos..."
          searchFields={['name', 'slug']}
          formClassName="max-w-4xl max-h-[90vh]"
          initialData={{
            name: '',
            slug: '',
            price: 0,
            stock: 0,
            is_active: true,
            is_featured: false,
            description: '',
          }}
          columns={[
            { 
              header: 'Produto', 
              key: 'name',
              render: (val, item) => (
                <div className="flex items-center gap-3">
                  {item.images?.[0] ? (
                    <img src={item.images[0]} className="w-10 h-10 object-contain bg-white rounded border" />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                  )}
                  <span className="font-medium">{val}</span>
                </div>
              )
            },
            { header: 'Preço', key: 'price', render: (val) => formatCurrency(Number(val)) },
            { 
              header: 'Estoque', 
              key: 'stock',
              render: (val) => (
                <Badge variant={Number(val) <= 0 ? 'destructive' : 'secondary'}>
                  {val} un
                </Badge>
              )
            },
            { 
              header: 'Status', 
              key: 'is_active',
              render: (val) => (
                <Badge className={val ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}>
                  {val ? 'Ativo' : 'Inativo'}
                </Badge>
              )
            },
          ]}
          customForm={(formData, setFormData) => (
            <ScrollArea className="max-h-[75vh] pr-4">
              <div className="space-y-6 pt-4 pb-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Produto *</Label>
                    <Input value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={formData.category_id || ''} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Preço de Venda *</Label>
                    <Input type="number" step="0.01" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço de Custo</Label>
                    <Input type="number" step="0.01" value={formData.cost_price || ''} onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço Comparativo</Label>
                    <Input type="number" step="0.01" value={formData.compare_price || ''} onChange={(e) => setFormData({ ...formData, compare_price: parseFloat(e.target.value) })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição Curta</Label>
                  <Input value={formData.short_description || ''} onChange={(e) => setFormData({ ...formData, short_description: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label>Descrição Completa</Label>
                  <Textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                </div>

                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                    <Label>Ativo</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.is_featured} onCheckedChange={(v) => setFormData({ ...formData, is_featured: v })} />
                    <Label>Destaque</Label>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          onBeforeSave={async (data) => {
            const finalData = {
              ...data,
              slug: data.slug || data.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, ''),
            };

            // Se for novo produto (sem ID), o CRUDModule cuidará do insert.
            // Mas precisamos lidar com as variantes e imagens se quisermos um fluxo completo.
            // Por enquanto, o CRUDModule salva apenas o objeto 'products'.
            return finalData;
          }}
        />
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
