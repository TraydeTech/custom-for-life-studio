/* eslint-disable @typescript-eslint/no-explicit-any --
   Componente CRUD genérico: render/onBeforeSave/customForm/formData e o nome de
   tabela dinâmico passado ao supabase.from() são boundaries genéricos onde `any`
   é intencional para os callers manterem flexibilidade de tipos. */
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
  filterFn?: (item: T) => boolean;
  filterControls?: React.ReactNode;
  /** Esconde o botão de editar (lápis). */
  hideEditButton?: boolean;
  /** Define quais registros podem ser excluídos (padrão: todos). */
  canDelete?: (item: T) => boolean;
  /** Mensagem quando a exclusão não é permitida para o registro. */
  deleteBlockedMessage?: string;
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
  filterFn,
  filterControls,
  hideEditButton = false,
  canDelete,
  deleteBlockedMessage = 'Este registro não pode ser excluído.',
}: CRUDModuleProps<T>) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingProduct] = useState<T | null>(null);
  const [formData, setFormData] = useState<any>(initialData);
  const [isLoadingItem, setIsLoadingItem] = useState(false);

  const { data: items, isLoading, isError, refetch } = useQuery({
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
      const { variants: originalVariants } = data;
      const finalData = onBeforeSave ? await onBeforeSave(data) : data;
      const { variants: _v, ...dbData } = finalData;

      const { data: newItem, error } = await supabase.from(tableName as any).insert([dbData]).select().single();
      if (error) throw error;

      const variants = originalVariants ?? _v;
      if (variants && Array.isArray(variants) && newItem) {
        const variantsWithProductId = variants.map((v: any, idx: number) => ({
          ...v,
          product_id: (newItem as any).id,
          sort_order: idx
        }));
        const { error: vError } = await supabase.from('product_variants').insert(variantsWithProductId);
        if (vError) throw vError;
      }
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
      const { variants: originalVariants } = data;
      const finalData = onBeforeSave ? await onBeforeSave(data) : data;
      const { variants: _v, ...dbData } = finalData;

      const { error } = await supabase.from(tableName as any).update(dbData).eq('id', id);
      if (error) throw error;

      const variants = originalVariants ?? _v;
      if (variants && Array.isArray(variants)) {
        await supabase.from('product_variants').delete().eq('product_id', id);
        
        const variantsWithProductId = variants.map((v: any, idx: number) => {
          const { id: _, created_at: ca, updated_at: ua, ...vData } = v; // Remove IDs e datas antigas
          return {
            ...vData,
            product_id: id,
            sort_order: idx
          };
        });
        
        if (variantsWithProductId.length > 0) {
          const { error: vError } = await supabase.from('product_variants').insert(variantsWithProductId);
          if (vError) throw vError;
        }
      }
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
      // .select() devolve as linhas apagadas: com RLS, um DELETE sem permissão
      // não dá erro, só apaga 0 linhas — nesse caso avisamos em vez de "sucesso".
      const { data, error } = await supabase.from(tableName as any).delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('sem permissão ou registro não encontrado');
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
    setFormData(initialData);
    setEditingProduct(null);
    setIsLoadingItem(true);
    setIsDialogOpen(true);
    if (onItemClick) {
      try {
        const result = await onItemClick(item);
        if (result) {
          setFormData(result);
          setEditingProduct(result);
          setIsLoadingItem(false);
          return;
        }
      } catch (error) {
        console.error("Erro ao carregar dados do item:", error);
      }
    }
    setEditingProduct(item);
    setFormData(item);
    setIsLoadingItem(false);
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
    const matchesSearch = !search || searchFields.some((field) => {
      const val = item[field];
      return val && String(val).toLowerCase().includes(search.toLowerCase());
    });
    const matchesFilter = !filterFn || filterFn(item);
    return matchesSearch && matchesFilter;
  });

  const renderActions = (item: T) => (
    <div className="flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      {customActions?.(item)}
      {!hideEditButton && (
        <Button variant="ghost" size="icon" aria-label={`Editar ${title}`} onClick={() => handleEdit(item)}>
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive"
        aria-label={`Excluir ${title}`}
        onClick={() => {
          if (canDelete && !canDelete(item)) {
            toast.error(deleteBlockedMessage);
            return;
          }
          if (confirm('Tem certeza que deseja excluir este registro?')) {
            deleteMutation.mutate(item.id);
          }
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {filterControls}
      </div>

      {isError ? (
        <div role="alert" className="rounded-lg border p-6 space-y-3">
          <p>Não foi possível carregar os registros. Confira a conexão e tente novamente.</p>
          <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : <>
      <div className="space-y-3 md:hidden">
        {isLoading ? <p role="status">Carregando registros...</p> : !filteredItems?.length ? (
          <p className="rounded-lg border p-4 text-muted-foreground">Nenhum registro encontrado</p>
        ) : filteredItems.map(item => (
          <article key={item.id} className="min-w-0 rounded-lg border bg-card p-4 space-y-3">
            <dl className="space-y-3">
              {columns.map((col, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-3">
                  <dt className="text-xs font-medium text-muted-foreground">{col.header}</dt>
                  <dd className="min-w-0 break-words text-sm">{col.render ? col.render(item[col.key], item) : String(item[col.key] ?? '-')}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t pt-2">{renderActions(item)}</div>
          </article>
        ))}
      </div>
      <div className="hidden md:block border rounded-lg">
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
                <TableRow key={item.id}>
                  {columns.map((col, i) => (
                    <TableCell key={i}>
                      {col.render ? col.render(item[col.key], item) : String(item[col.key] ?? '-')}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    {renderActions(item)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </>}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); resetForm(); } }}>
        <DialogContent
          className={`${formClassName} max-h-[90dvh] overflow-y-auto`}
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{isLoadingItem ? 'Carregando...' : `${editingItem ? 'Editar' : 'Novo'} ${title}`}</DialogTitle>
          </DialogHeader>
          {isLoadingItem ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 pt-4">
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
            <div className="flex flex-wrap justify-end gap-2 pt-4 flex-shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingItem ? 'Salvar Alterações' : 'Criar Registro'}
              </Button>
            </div>
          </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
