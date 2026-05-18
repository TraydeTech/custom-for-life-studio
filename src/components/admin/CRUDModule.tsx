import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CRUDModuleProps<T> {
  title: string;
  tableName: string;
  queryKey: string;
  columns: {
    header: string;
    key: keyof T;
    render?: (value: any, item: T) => React.ReactNode;
  }[];
  formFields?: {
    label: string;
    key: string;
    type?: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'switch';
    required?: boolean;
    options?: { label: string; value: string }[];
    placeholder?: string;
  }[];
  initialData: Partial<T>;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  onBeforeSave?: (data: any) => any;
  customActions?: (item: T) => React.ReactNode;
  hideAddButton?: boolean;
  onItemClick?: (item: T) => Promise<any> | void;
  formClassName?: string;
  customForm?: (formData: any, setFormData: (data: any) => void) => React.ReactNode;
}

export function CRUDModule<T extends { id: string }>({
  title,
  tableName,
  queryKey,
  columns,
  formFields,
  initialData,
  searchPlaceholder = "Buscar...",
  searchFields = [],
  onBeforeSave,
  customActions,
  hideAddButton = false,
  onItemClick,
  formClassName = "sm:max-w-[425px]",
  customForm,
}: CRUDModuleProps<T>) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingProduct] = useState<T | null>(null);
  const [formData, setFormData] = useState<any>(initialData);

  const { data: items, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown) as T[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const finalData = onBeforeSave ? onBeforeSave(data) : data;
      const { error } = await supabase.from(tableName as any).insert([finalData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${title} criado com sucesso!`);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const finalData = onBeforeSave ? onBeforeSave(data) : data;
      const { error } = await supabase.from(tableName as any).update(finalData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${title} atualizado com sucesso!`);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${title} excluído com sucesso!`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData(initialData);
    setEditingProduct(null);
  };

  const handleEdit = async (item: T) => {
    let dataToEdit = item;
    if (onItemClick) {
      const result = await onItemClick(item);
      if (result) dataToEdit = result;
    }
    setEditingProduct(dataToEdit);
    setFormData(dataToEdit);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredItems = items?.filter((item) => {
    if (!search) return true;
    return searchFields.some((field) => {
      const val = item[field];
      return val && String(val).toLowerCase().includes(search.toLowerCase());
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">{title}</h1>
          <p className="text-muted-foreground">Gerenciamento de {title.toLowerCase()}</p>
        </div>
        {!hideAddButton && (
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Registro
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, i) => (
                <TableHead key={i}>{col.header}</TableHead>
              ))}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredItems?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredItems?.map((item) => (
                <TableRow key={item.id} className={onItemClick ? "cursor-pointer" : ""} onClick={() => onItemClick?.(item)}>
                  {columns.map((col, i) => (
                    <TableCell key={i}>
                      {col.render ? col.render(item[col.key], item) : String(item[col.key] || '-')}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {customActions?.(item)}
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir este registro?')) {
                            deleteMutation.mutate(item.id);
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={formClassName}>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar' : 'Novo'} {title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {customForm ? customForm(formData, setFormData) : formFields?.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label} {field.required && '*'}</Label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={field.key}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    required={field.required}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <Input
                    id={field.key}
                    type={field.type || 'text'}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    required={field.required}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingItem ? 'Salvar Alterações' : 'Criar Registro'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
