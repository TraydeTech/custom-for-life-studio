import { useState, useRef } from 'react';
import { CRUDModule } from '@/components/admin/CRUDModule';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Package, Image as ImageIcon, Plus, X, Upload, Loader2, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type StatusFilter = 'all' | 'active' | 'inactive';

export default function AdminProdutos() {
  const queryClient = useQueryClient();
  const [uploadingVariant, setUploadingVariant] = useState<number | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Filter state
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');
  const [filterStock, setFilterStock] = useState<StockFilter>('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // New category inline state
  const [newCatDialog, setNewCatDialog] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [pendingCatCallback, setPendingCatCallback] = useState<((id: string) => void) | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
      return data || [];
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      const { data, error } = await supabase.from('categories').insert([{ name, slug, is_active: true }]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(`Categoria "${data.name}" criada!`);
      if (pendingCatCallback) pendingCatCallback(data.id);
      setNewCatDialog(false);
      setNewCatName('');
      setPendingCatCallback(null);
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar categoria: ' + error.message);
    },
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

  const [uploadingExtra, setUploadingExtra] = useState<string | null>(null); // `${variantIdx}-${imgIdx}`

  const handleMainImageUpload = async (variantIndex: number, file: File, variants: ColorVariant[], setVariants: (v: ColorVariant[]) => void) => {
    setUploadingVariant(variantIndex);
    try {
      const url = await uploadImage(file);
      const updated = variants.map((v, i) => i === variantIndex ? { ...v, main_image: url } : v);
      setVariants(updated);
    } catch (error) {
      toast.error('Erro ao fazer upload: ' + (error as Error).message);
    }
    setUploadingVariant(null);
  };

  const handleAdditionalImageUpload = async (variantIndex: number, file: File, variants: ColorVariant[], setVariants: (v: ColorVariant[]) => void) => {
    const key = `${variantIndex}-new`;
    setUploadingExtra(key);
    try {
      const url = await uploadImage(file);
      const updated = variants.map((v, i) => i === variantIndex
        ? { ...v, additional_images: [...(v.additional_images || []), url] }
        : v);
      setVariants(updated);
    } catch (error) {
      toast.error('Erro ao fazer upload: ' + (error as Error).message);
    }
    setUploadingExtra(null);
  };

  const hasActiveFilters = filterCategory !== 'all' || filterPriceMin !== '' || filterPriceMax !== '' || filterStock !== 'all' || filterStatus !== 'all';

  const productFilterFn = (item: Product): boolean => {
    if (filterCategory !== 'all' && item.category_id !== filterCategory) return false;
    if (filterPriceMin !== '' && Number(item.price) < Number(filterPriceMin)) return false;
    if (filterPriceMax !== '' && Number(item.price) > Number(filterPriceMax)) return false;
    if (filterStatus === 'active' && !item.is_active) return false;
    if (filterStatus === 'inactive' && item.is_active) return false;
    const stock = Number(item.stock ?? 0);
    if (filterStock === 'in_stock' && stock <= 0) return false;
    if (filterStock === 'low_stock' && (stock <= 0 || stock > 5)) return false;
    if (filterStock === 'out_of_stock' && stock > 0) return false;
    return true;
  };

  const clearFilters = () => {
    setFilterCategory('all');
    setFilterPriceMin('');
    setFilterPriceMax('');
    setFilterStock('all');
    setFilterStatus('all');
  };

  const filterControls = (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="h-8 gap-1.5"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {hasActiveFilters && (
            <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-primary-foreground text-primary">
              {[filterCategory !== 'all', filterPriceMin !== '', filterPriceMax !== '', filterStock !== 'all', filterStatus !== 'all'].filter(Boolean).length}
            </Badge>
          )}
        </Button>
        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={clearFilters}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 p-3 border rounded-lg bg-muted/30">
          <div className="space-y-1 min-w-[160px]">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Preço mínimo</Label>
            <Input
              type="number"
              placeholder="R$ 0"
              value={filterPriceMin}
              onChange={(e) => setFilterPriceMin(e.target.value)}
              className="h-8 text-xs w-28"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Preço máximo</Label>
            <Input
              type="number"
              placeholder="R$ ∞"
              value={filterPriceMax}
              onChange={(e) => setFilterPriceMax(e.target.value)}
              className="h-8 text-xs w-28"
            />
          </div>

          <div className="space-y-1 min-w-[140px]">
            <Label className="text-xs text-muted-foreground">Estoque</Label>
            <Select value={filterStock} onValueChange={(v) => setFilterStock(v as StockFilter)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="in_stock">Em estoque</SelectItem>
                <SelectItem value="low_stock">Estoque baixo (≤5)</SelectItem>
                <SelectItem value="out_of_stock">Sem estoque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <CRUDModule<Product>
          title="Produtos"
          tableName="products"
          queryKey="admin-products"
          searchPlaceholder="Buscar produtos..."
          searchFields={['name', 'slug']}
          formClassName="max-w-4xl h-[90vh] flex flex-col"
          filterFn={productFilterFn}
          filterControls={filterControls}
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
                    <img
                      src={item.images[0]}
                      className="w-10 h-10 object-contain bg-white rounded border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setZoomedImage(item.images[0])}
                    />
                  ) : (
                    <div className="w-10 h-10 bg-white rounded border flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                  )}
                  <div>
                    <div className="font-medium">{val}</div>
                    {item.category_id && (
                      <div className="text-xs text-muted-foreground">
                        {categories.find(c => c.id === item.category_id)?.name || '—'}
                      </div>
                    )}
                  </div>
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
          customForm={(formData, setFormData) => {
            const variants = (formData.variants as ColorVariant[]) || [];
            
            const addVariant = () => {
              const newVariants = [...variants, { color_name: '', main_image: '', additional_images: [], sort_order: variants.length, stock: 0 }];
              setFormData({ ...formData, variants: newVariants });
              
              // Scroll para o fim após adicionar
              setTimeout(() => {
                const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]');
                if (scrollArea) {
                  scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' });
                }
              }, 100);
            };

            const removeVariant = (index: number) => {
              setFormData({ ...formData, variants: variants.filter((_, i) => i !== index) });
            };

            return (
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6 pt-4 pb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Produto *</Label>
                      <Input value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select
                        value={formData.category_id || ''}
                        onValueChange={(v) => {
                          if (v === '__new__') {
                            setPendingCatCallback(() => (id: string) => setFormData({ ...formData, category_id: id }));
                            setNewCatDialog(true);
                          } else {
                            setFormData({ ...formData, category_id: v });
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          <SelectItem value="__new__" className="text-primary font-medium border-t mt-1 pt-2">
                            <span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Nova Categoria</span>
                          </SelectItem>
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

                  {/* Gerenciamento de Cores/Variantes */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Cores e Estoque</h3>
                    </div>

                    {variants.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma cor cadastrada. Adicione ao menos uma para gerenciar o estoque.</p>}

                    <div className="space-y-4">
                      {variants.map((v, idx) => (
                        <div key={idx} className="p-3 border rounded-lg bg-muted/20 space-y-3">
                          {/* Header row: nome, estoque, remover */}
                          <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                              <Label className="text-[10px]">Nome da Cor</Label>
                              <Input
                                className="h-8 text-xs"
                                value={v.color_name}
                                onChange={(e) => {
                                  const updated = [...variants];
                                  updated[idx].color_name = e.target.value;
                                  setFormData({ ...formData, variants: updated });
                                }}
                              />
                            </div>
                            <div className="w-24 space-y-1">
                              <Label className="text-[10px]">Estoque</Label>
                              <Input
                                type="number"
                                className="h-8 text-xs"
                                value={v.stock}
                                onChange={(e) => {
                                  const updated = [...variants];
                                  updated[idx].stock = parseInt(e.target.value) || 0;
                                  setFormData({ ...formData, variants: updated });
                                }}
                              />
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => removeVariant(idx)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Galeria de imagens */}
                          <div className="flex flex-wrap gap-2">
                            {/* Imagem principal */}
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-16 h-16 border-2 border-primary/40 rounded bg-white overflow-hidden relative">
                                {v.main_image ? (
                                  <img src={v.main_image} className="w-full h-full object-contain cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setZoomedImage(v.main_image)} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[9px] text-muted-foreground text-center px-1">Principal</div>
                                )}
                                {uploadingVariant === idx && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-white" /></div>}
                              </div>
                              <div className="flex gap-1">
                                <Label className="cursor-pointer text-[9px] flex items-center gap-1 px-1.5 py-0.5 border rounded hover:bg-muted transition-colors">
                                  <Upload className="h-2.5 w-2.5" />
                                  {v.main_image ? 'Trocar' : 'Add'}
                                  <Input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleMainImageUpload(idx, file, variants, (v) => setFormData({ ...formData, variants: v }));
                                    e.target.value = '';
                                  }} />
                                </Label>
                                {v.main_image && (
                                  <button type="button" onClick={() => {
                                    const updated = variants.map((vv, i) => i === idx ? { ...vv, main_image: '' } : vv);
                                    setFormData({ ...formData, variants: updated });
                                  }} className="text-[9px] flex items-center px-1.5 py-0.5 border rounded text-destructive hover:bg-destructive/10 transition-colors">
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Imagens adicionais */}
                            {(v.additional_images || []).map((img, imgIdx) => (
                              <div key={imgIdx} className="flex flex-col items-center gap-1">
                                <div className="w-16 h-16 border rounded bg-white overflow-hidden relative">
                                  <img src={img} className="w-full h-full object-contain cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setZoomedImage(img)} />
                                  {uploadingExtra === `${idx}-${imgIdx}` && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-white" /></div>}
                                </div>
                                <button type="button" onClick={() => {
                                  const updated = variants.map((vv, i) => i === idx ? { ...vv, additional_images: vv.additional_images.filter((_, ii) => ii !== imgIdx) } : vv);
                                  setFormData({ ...formData, variants: updated });
                                }} className="text-[9px] flex items-center gap-0.5 px-1.5 py-0.5 border rounded text-destructive hover:bg-destructive/10 transition-colors">
                                  <X className="h-2.5 w-2.5" /> Remover
                                </button>
                              </div>
                            ))}

                            {/* Botão adicionar imagem extra */}
                            <div className="flex flex-col items-center gap-1">
                              <Label className="cursor-pointer w-16 h-16 border-2 border-dashed rounded bg-white flex flex-col items-center justify-center gap-1 hover:bg-muted/50 transition-colors text-muted-foreground">
                                {uploadingExtra === `${idx}-new` ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Plus className="h-5 w-5" /><span className="text-[9px]">Foto</span></>}
                                <Input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleAdditionalImageUpload(idx, file, variants, (v) => setFormData({ ...formData, variants: v }));
                                  e.target.value = '';
                                }} />
                              </Label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button type="button" variant="outline" className="w-full border-dashed" onClick={addVariant}>
                      <Plus className="h-4 w-4 mr-2" /> Adicionar Cor
                    </Button>

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
            );
          }}
          onBeforeSave={async (data) => {
            const { variants, ...productData } = data;
            
            // Calcula estoque total
            const totalStock = Array.isArray(variants) 
              ? variants.reduce((sum: number, v: { stock?: string | number }) => sum + (parseInt(String(v.stock ?? 0)) || 0), 0)
              : 0;

            const finalData = {
              ...productData,
              stock: totalStock,
              images: Array.isArray(variants) ? variants.map((v: { main_image?: string | null }) => v.main_image).filter(Boolean) : [],
              slug: data.slug || data.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, ''),
            };

            return finalData;
          }}
          onItemClick={async (item) => {
            // Ao clicar para editar, precisamos carregar as variantes
            const { data: variants } = await supabase
              .from('product_variants')
              .select('*')
              .eq('product_id', item.id)
              .order('sort_order');
            
            return { ...item, variants: variants || [] };
          }}
        />

        <Dialog open={newCatDialog} onOpenChange={(open) => { if (!open) { setNewCatDialog(false); setNewCatName(''); setPendingCatCallback(null); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Nome da Categoria *</Label>
                <Input
                  autoFocus
                  placeholder="Ex: Camisetas"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCatName.trim()) {
                      e.preventDefault();
                      createCategoryMutation.mutate(newCatName.trim());
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setNewCatDialog(false); setNewCatName(''); setPendingCatCallback(null); }}>
                Cancelar
              </Button>
              <Button
                disabled={!newCatName.trim() || createCategoryMutation.isPending}
                onClick={() => createCategoryMutation.mutate(newCatName.trim())}
              >
                {createCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar Categoria
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white">
            <DialogHeader className="p-4 border-b">
              <DialogTitle>Visualização da Imagem</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4 bg-white">
              {zoomedImage && (
                <img 
                  src={zoomedImage} 
                  alt="Zoom" 
                  className="max-w-full max-h-[70vh] object-contain" 
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
