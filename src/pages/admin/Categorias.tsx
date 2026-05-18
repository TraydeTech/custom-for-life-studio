import { useState } from 'react';
import { CRUDModule } from '@/components/admin/CRUDModule';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';

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
          formClassName="max-w-2xl max-h-[90vh]"
          initialData={{
            name: '',
            slug: '',
            description: '',
            is_active: true,
            sort_order: 0,
            technical_sheet: null,
          }}
          columns={[
            { header: 'Ordem', key: 'sort_order' },
            { header: 'Nome', key: 'name' },
            { header: 'Slug', key: 'slug' },
            { 
              header: 'Ficha Técnica', 
              key: 'technical_sheet' as any,
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
          customForm={(formData, setFormData) => (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input 
                    value={formData.name || ''} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input 
                    value={formData.slug || ''} 
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="gerado-automaticamente"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea 
                    value={formData.description || ''} 
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ordem</Label>
                    <Input 
                      type="number"
                      value={formData.sort_order || 0} 
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-8">
                    <Switch 
                      id="cat-active" 
                      checked={formData.is_active} 
                      onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} 
                    />
                    <Label htmlFor="cat-active">Ativa</Label>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Ficha Técnica
                    </Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        const sections = Array.isArray(formData.technical_sheet) ? [...formData.technical_sheet] : [];
                        sections.push({ title: '', items: [{ label: '', value: '' }] });
                        setFormData({ ...formData, technical_sheet: sections });
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Seção
                    </Button>
                  </div>
                  
                  {Array.isArray(formData.technical_sheet) && formData.technical_sheet.map((section: any, sIdx: number) => (
                    <div key={sIdx} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Input 
                          value={section.title} 
                          onChange={(e) => {
                            const sections = [...formData.technical_sheet];
                            sections[sIdx].title = e.target.value;
                            setFormData({ ...formData, technical_sheet: sections });
                          }}
                          placeholder="Título da seção"
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => {
                            const sections = formData.technical_sheet.filter((_: any, i: number) => i !== sIdx);
                            setFormData({ ...formData, technical_sheet: sections });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {section.items.map((item: any, iIdx: number) => (
                        <div key={iIdx} className="flex items-center gap-2">
                          <Input 
                            value={item.label} 
                            placeholder="Campo" 
                            className="w-2/5"
                            onChange={(e) => {
                              const sections = [...formData.technical_sheet];
                              sections[sIdx].items[iIdx].label = e.target.value;
                              setFormData({ ...formData, technical_sheet: sections });
                            }}
                          />
                          <Input 
                            value={item.value} 
                            placeholder="Valor" 
                            className="flex-1"
                            onChange={(e) => {
                              const sections = [...formData.technical_sheet];
                              sections[sIdx].items[iIdx].value = e.target.value;
                              setFormData({ ...formData, technical_sheet: sections });
                            }}
                          />
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive"
                            onClick={() => {
                              const sections = [...formData.technical_sheet];
                              sections[sIdx].items = sections[sIdx].items.filter((_: any, i: number) => i !== iIdx);
                              setFormData({ ...formData, technical_sheet: sections });
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          const sections = [...formData.technical_sheet];
                          sections[sIdx].items.push({ label: '', value: '' });
                          setFormData({ ...formData, technical_sheet: sections });
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" /> Campo
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}
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
