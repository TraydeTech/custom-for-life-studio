import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';
import { ScrollArea } from '@/components/ui/scroll-area';

type Category = Tables<'categories'>;

interface TechSheetItem {
  label: string;
  value: string;
}

interface TechSheetSection {
  title: string;
  items: TechSheetItem[];
}

export default function AdminCategorias() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    is_active: true,
    sort_order: '0',
  });
  const [techSections, setTechSections] = useState<TechSheetSection[]>([]);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as (Category & { technical_sheet?: TechSheetSection[] })[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('categories').insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria criada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao criar categoria: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from('categories').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria atualizada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao atualizar categoria: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria excluída com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir categoria: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      is_active: true,
      sort_order: '0',
    });
    setTechSections([]);
    setEditingCategory(null);
  };

  const handleEdit = (category: Category & { technical_sheet?: TechSheetSection[] }) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      is_active: category.is_active ?? true,
      sort_order: String(category.sort_order || 0),
    });
    setTechSections(
      Array.isArray(category.technical_sheet) ? category.technical_sheet : []
    );
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
      description: formData.description || null,
      is_active: formData.is_active,
      sort_order: parseInt(formData.sort_order) || 0,
      technical_sheet: techSections.length > 0 ? techSections : null,
    };

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Tech sheet helpers
  const addSection = () => {
    setTechSections([...techSections, { title: '', items: [{ label: '', value: '' }] }]);
  };

  const removeSection = (sIdx: number) => {
    setTechSections(techSections.filter((_, i) => i !== sIdx));
  };

  const updateSectionTitle = (sIdx: number, title: string) => {
    const updated = [...techSections];
    updated[sIdx].title = title;
    setTechSections(updated);
  };

  const addItem = (sIdx: number) => {
    const updated = [...techSections];
    updated[sIdx].items.push({ label: '', value: '' });
    setTechSections(updated);
  };

  const removeItem = (sIdx: number, iIdx: number) => {
    const updated = [...techSections];
    updated[sIdx].items = updated[sIdx].items.filter((_, i) => i !== iIdx);
    setTechSections(updated);
  };

  const updateItem = (sIdx: number, iIdx: number, field: 'label' | 'value', val: string) => {
    const updated = [...techSections];
    updated[sIdx].items[iIdx][field] = val;
    setTechSections(updated);
  };

  const hasTechSheet = (cat: any) => {
    return Array.isArray(cat.technical_sheet) && cat.technical_sheet.length > 0;
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-heading font-bold">Categorias</h1>
              <p className="text-muted-foreground">Organize seus produtos em categorias</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Categoria
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] pr-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        placeholder="gerado-automaticamente"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sort_order">Ordem</Label>
                      <Input
                        id="sort_order"
                        type="number"
                        value={formData.sort_order}
                        onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active">Ativa</Label>
                    </div>

                    {/* Ficha Técnica */}
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Ficha Técnica
                        </Label>
                        <Button type="button" variant="outline" size="sm" onClick={addSection}>
                          <Plus className="mr-1 h-3 w-3" /> Seção
                        </Button>
                      </div>

                      {techSections.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma ficha técnica cadastrada. Clique em "+ Seção" para começar.
                        </p>
                      )}

                      {techSections.map((section, sIdx) => (
                        <div key={sIdx} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                          <div className="flex items-center gap-2">
                            <Input
                              value={section.title}
                              onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                              placeholder="Título da seção (ex: Especificações Técnicas)"
                              className="font-medium"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive shrink-0"
                              onClick={() => removeSection(sIdx)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          {section.items.map((item, iIdx) => (
                            <div key={iIdx} className="flex items-center gap-2">
                              <Input
                                value={item.label}
                                onChange={(e) => updateItem(sIdx, iIdx, 'label', e.target.value)}
                                placeholder="Campo"
                                className="w-2/5"
                              />
                              <Input
                                value={item.value}
                                onChange={(e) => updateItem(sIdx, iIdx, 'value', e.target.value)}
                                placeholder="Valor"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive shrink-0"
                                onClick={() => removeItem(sIdx, iIdx)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}

                          <Button type="button" variant="ghost" size="sm" onClick={() => addItem(sIdx)}>
                            <Plus className="mr-1 h-3 w-3" /> Campo
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                        {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                      </Button>
                    </div>
                  </form>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Ficha Técnica</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : categories?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma categoria encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  categories?.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>{category.sort_order}</TableCell>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                      <TableCell>
                        {hasTechSheet(category) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-primary">
                            <FileText className="h-3 w-3" /> Cadastrada
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          category.is_active 
                            ? 'bg-green-500/20 text-green-500' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {category.is_active ? 'Ativa' : 'Inativa'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Tem certeza que deseja excluir esta categoria?')) {
                                deleteMutation.mutate(category.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}