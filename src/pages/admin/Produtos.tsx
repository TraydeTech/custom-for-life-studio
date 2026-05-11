import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Search, DollarSign, TrendingUp, Package, AlertTriangle, Upload, X, Eye, Image } from 'lucide-react';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/utils';

type Product = Tables<'products'>;
type Category = Tables<'categories'>;

interface Supplier {
  id: string;
  name: string;
}

interface ColorVariant {
  id?: string;
  color_name: string;
  main_image: string;
  additional_images: string[];
  sort_order: number;
}

export default function AdminProdutos() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [colorVariants, setColorVariants] = useState<ColorVariant[]>([]);
  const [uploadingVariant, setUploadingVariant] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    short_description: '',
    price: '',
    cost_price: '',
    compare_price: '',
    stock: '',
    min_quantity: '1',
    category_id: '',
    supplier_id: '',
    is_active: true,
    is_featured: false,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as Supplier[];
    },
  });

  // Fetch variants for all products
  const { data: allVariants } = useQuery({
    queryKey: ['product-variants'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('product_variants')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = `products/${fileName}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleMainImageUpload = async (variantIndex: number, file: File) => {
    setUploadingVariant(variantIndex);
    try {
      const url = await uploadImage(file);
      setColorVariants(prev => prev.map((v, i) =>
        i === variantIndex ? { ...v, main_image: url } : v
      ));
    } catch (error: any) {
      toast.error('Erro ao fazer upload: ' + error.message);
    }
    setUploadingVariant(null);
  };

  const handleAdditionalImagesUpload = async (variantIndex: number, files: FileList) => {
    setUploadingVariant(variantIndex);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadImage(file);
        urls.push(url);
      }
      setColorVariants(prev => prev.map((v, i) =>
        i === variantIndex ? { ...v, additional_images: [...v.additional_images, ...urls] } : v
      ));
    } catch (error: any) {
      toast.error('Erro ao fazer upload: ' + error.message);
    }
    setUploadingVariant(null);
  };

  const removeAdditionalImage = (variantIndex: number, imageIndex: number) => {
    setColorVariants(prev => prev.map((v, i) =>
      i === variantIndex
        ? { ...v, additional_images: v.additional_images.filter((_, idx) => idx !== imageIndex) }
        : v
    ));
  };

  const addColorVariant = () => {
    setColorVariants(prev => [...prev, {
      color_name: '',
      main_image: '',
      additional_images: [],
      sort_order: prev.length,
    }]);
  };

  const removeColorVariant = (index: number) => {
    setColorVariants(prev => prev.filter((_, i) => i !== index));
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // First image from variants as product main image
      const firstVariantImage = colorVariants[0]?.main_image || null;
      const allImages = colorVariants.flatMap(v => [v.main_image, ...v.additional_images].filter(Boolean));

      const productData = {
        ...data,
        images: allImages.length > 0 ? allImages : null,
      };

      const { data: newProduct, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single();
      if (error) throw error;

      // Save color variants
      if (colorVariants.length > 0) {
        const variantsToInsert = colorVariants
          .filter(v => v.color_name.trim())
          .map((v, i) => ({
            product_id: newProduct.id,
            color_name: v.color_name,
            main_image: v.main_image || null,
            additional_images: v.additional_images,
            sort_order: i,
          }));

        if (variantsToInsert.length > 0) {
          const { error: varError } = await (supabase as any)
            .from('product_variants')
            .insert(variantsToInsert);
          if (varError) throw varError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
      toast.success('Produto criado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const isDup = error?.code === '23505' || /products_slug_key|duplicate key/i.test(error?.message || '');
      toast.error(isDup
        ? 'Já existe um produto com este slug. Altere o nome ou edite o slug manualmente.'
        : 'Erro ao criar produto: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const allImages = colorVariants.flatMap(v => [v.main_image, ...v.additional_images].filter(Boolean));

      const productData = {
        ...data,
        images: allImages.length > 0 ? allImages : null,
      };

      const { error } = await supabase.from('products').update(productData).eq('id', id);
      if (error) throw error;

      // Delete old variants and insert new ones
      await (supabase as any).from('product_variants').delete().eq('product_id', id);

      if (colorVariants.length > 0) {
        const variantsToInsert = colorVariants
          .filter(v => v.color_name.trim())
          .map((v, i) => ({
            product_id: id,
            color_name: v.color_name,
            main_image: v.main_image || null,
            additional_images: v.additional_images,
            sort_order: i,
          }));

        if (variantsToInsert.length > 0) {
          const { error: varError } = await (supabase as any)
            .from('product_variants')
            .insert(variantsToInsert);
          if (varError) throw varError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
      toast.success('Produto atualizado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const isDup = error?.code === '23505' || /products_slug_key|duplicate key/i.test(error?.message || '');
      toast.error(isDup
        ? 'Já existe outro produto com este slug. Use um slug único.'
        : 'Erro ao atualizar produto: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
      toast.success('Produto excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir produto: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '', slug: '', description: '', short_description: '',
      price: '', cost_price: '', compare_price: '', stock: '',
      min_quantity: '1', category_id: '', supplier_id: '',
      is_active: true, is_featured: false,
    });
    setEditingProduct(null);
    setColorVariants([]);
  };

  const handleEdit = async (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      short_description: product.short_description || '',
      price: String(product.price),
      cost_price: product.cost_price ? String(product.cost_price) : '',
      compare_price: product.compare_price ? String(product.compare_price) : '',
      stock: product.stock ? String(product.stock) : '',
      min_quantity: product.min_quantity ? String(product.min_quantity) : '1',
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      is_active: product.is_active ?? true,
      is_featured: product.is_featured ?? false,
    });

    // Load existing variants
    const { data: variants } = await (supabase as any)
      .from('product_variants')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order');

    if (variants && variants.length > 0) {
      setColorVariants(variants.map(v => ({
        id: v.id,
        color_name: v.color_name,
        main_image: v.main_image || '',
        additional_images: v.additional_images || [],
        sort_order: v.sort_order || 0,
      })));
    } else {
      setColorVariants([]);
    }

    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      description: formData.description || null,
      short_description: formData.short_description || null,
      price: parseFloat(formData.price),
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
      compare_price: formData.compare_price ? parseFloat(formData.compare_price) : null,
      stock: formData.stock ? parseInt(formData.stock) : 0,
      min_quantity: parseInt(formData.min_quantity) || 1,
      category_id: formData.category_id || null,
      supplier_id: formData.supplier_id || null,
      is_active: formData.is_active,
      is_featured: formData.is_featured,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const inventoryStats = useMemo(() => {
    if (!products) return { totalCost: 0, totalSale: 0, profit: 0, marginPercent: 0, noSupplier: 0 };
    const totalCost = products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.stock || 0)), 0);
    const totalSale = products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
    const noSupplier = products.filter(p => !p.supplier_id).length;
    const profit = totalSale - totalCost;
    const marginPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    return { totalCost, totalSale, profit, marginPercent, noSupplier };
  }, [products]);

  const calculateMargin = (price: number, costPrice: number): number => {
    if (!costPrice || costPrice === 0) return 0;
    return ((price - costPrice) / costPrice) * 100;
  };

  // Auto-calc margin in form
  const formMargin = formData.cost_price && formData.price
    ? calculateMargin(parseFloat(formData.price), parseFloat(formData.cost_price))
    : 0;

  const getStatusBadge = (product: Product) => {
    if (!product.is_active) return <Badge variant="secondary">Inativo</Badge>;
    if ((product.stock ?? 0) <= 0) return <Badge variant="destructive">Esgotado</Badge>;
    return <Badge className="bg-primary/20 text-primary border-primary/30">Ativo</Badge>;
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-heading font-bold">Produtos</h1>
              <p className="text-muted-foreground">Gerencie seu catálogo de produtos</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Informações Básicas */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Informações Básicas</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome do Produto *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">Categoria</Label>
                        <Select
                          value={formData.category_id}
                          onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplier">Fornecedor</Label>
                      <Select
                        value={formData.supplier_id}
                        onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um fornecedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers?.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição do Produto</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={4}
                        placeholder="Descreva o produto em detalhes..."
                      />
                    </div>
                  </div>

                  {/* Preços e Estoque */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Preços e Estoque</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cost_price">Preço de Custo (R$)</Label>
                        <Input
                          id="cost_price"
                          type="number"
                          step="0.01"
                          value={formData.cost_price}
                          onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price">Preço de Venda (R$) *</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Margem de Lucro</Label>
                        <div className={`flex items-center h-10 px-3 rounded-md border text-sm font-medium ${
                          formMargin >= 30 ? 'bg-primary/10 text-primary border-primary/30' :
                          formMargin >= 15 ? 'bg-secondary/10 text-secondary border-secondary/30' :
                          formMargin > 0 ? 'bg-destructive/10 text-destructive border-destructive/30' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {formMargin > 0 ? `${formMargin.toFixed(1)}%` : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stock">Quantidade em Estoque</Label>
                        <Input
                          id="stock"
                          type="number"
                          value={formData.stock}
                          onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compare_price">Preço Comparativo (R$)</Label>
                        <Input
                          id="compare_price"
                          type="number"
                          step="0.01"
                          value={formData.compare_price}
                          onChange={(e) => setFormData({ ...formData, compare_price: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <div className="flex items-center gap-6 h-10">
                          <div className="flex items-center gap-2">
                            <Switch
                              id="is_active"
                              checked={formData.is_active}
                              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                            />
                            <Label htmlFor="is_active" className="text-sm">Ativo</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              id="is_featured"
                              checked={formData.is_featured}
                              onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                            />
                            <Label htmlFor="is_featured" className="text-sm">Destaque</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Variações de Cor */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Variações de Cor</h3>
                      <Button type="button" variant="outline" size="sm" onClick={addColorVariant}>
                        <Plus className="mr-1 h-3 w-3" />
                        Adicionar Cor
                      </Button>
                    </div>

                    {colorVariants.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                        Nenhuma variação de cor adicionada. Clique em "Adicionar Cor" para começar.
                      </p>
                    )}

                    {colorVariants.map((variant, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-4 relative">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeColorVariant(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>

                        <div className="space-y-2">
                          <Label>Nome da Cor *</Label>
                          <Input
                            value={variant.color_name}
                            onChange={(e) => setColorVariants(prev =>
                              prev.map((v, i) => i === index ? { ...v, color_name: e.target.value } : v)
                            )}
                            placeholder="Ex: Laranja, Azul Marinho, Rosa..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Main image */}
                          <div className="space-y-2">
                            <Label>Imagem Principal</Label>
                            {variant.main_image ? (
                              <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                                <img src={variant.main_image} alt={variant.color_name} className="w-full h-full object-cover" />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute top-1 right-1 h-5 w-5 bg-background/80"
                                  onClick={() => setColorVariants(prev =>
                                    prev.map((v, i) => i === index ? { ...v, main_image: '' } : v)
                                  )}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div
                                className="w-32 h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary transition-colors"
                                onClick={() => fileInputRefs.current[`main-${index}`]?.click()}
                              >
                                <Upload className="h-5 w-5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Upload</span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              ref={(el) => { fileInputRefs.current[`main-${index}`] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleMainImageUpload(index, file);
                                e.target.value = '';
                              }}
                            />
                          </div>

                          {/* Additional images */}
                          <div className="space-y-2">
                            <Label>Imagens Adicionais</Label>
                            <div className="flex flex-wrap gap-2">
                              {variant.additional_images.map((img, imgIdx) => (
                                <div key={imgIdx} className="relative w-16 h-16 rounded-md overflow-hidden border">
                                  <img src={img} alt="" className="w-full h-full object-cover" />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-0 right-0 h-4 w-4 bg-background/80"
                                    onClick={() => removeAdditionalImage(index, imgIdx)}
                                  >
                                    <X className="h-2 w-2" />
                                  </Button>
                                </div>
                              ))}
                              <div
                                className="w-16 h-16 rounded-md border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                                onClick={() => fileInputRefs.current[`add-${index}`]?.click()}
                              >
                                <Plus className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              ref={(el) => { fileInputRefs.current[`add-${index}`] = el; }}
                              onChange={(e) => {
                                const files = e.target.files;
                                if (files && files.length > 0) handleAdditionalImagesUpload(index, files);
                                e.target.value = '';
                              }}
                            />
                          </div>
                        </div>

                        {uploadingVariant === index && (
                          <div className="text-xs text-muted-foreground animate-pulse">Fazendo upload...</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {editingProduct ? 'Salvar Alterações' : 'Criar Produto'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Dashboard de Inventário */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total em Custo</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(inventoryStats.totalCost)}</div>
                <p className="text-xs text-muted-foreground">Valor de compra do estoque</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total em Venda</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(inventoryStats.totalSale)}</div>
                <p className="text-xs text-muted-foreground">Valor potencial de venda</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lucro Potencial</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${inventoryStats.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(inventoryStats.profit)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Margem: {inventoryStats.marginPercent.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card className={inventoryStats.noSupplier > 0 ? 'border-secondary' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sem Fornecedor</CardTitle>
                <AlertTriangle className={`h-4 w-4 ${inventoryStats.noSupplier > 0 ? 'text-secondary' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${inventoryStats.noSupplier > 0 ? 'text-secondary' : ''}`}>
                  {inventoryStats.noSupplier}
                </div>
                <p className="text-xs text-muted-foreground">
                  {inventoryStats.noSupplier > 0 ? 'Produtos sem vínculo' : 'Todos vinculados'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Foto</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Venda</TableHead>
                  <TableHead>Margem</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">Carregando...</TableCell>
                  </TableRow>
                ) : filteredProducts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts?.map((product) => {
                    const supplierName = suppliers?.find(s => s.id === product.supplier_id)?.name;
                    const costPrice = product.cost_price || 0;
                    const margin = calculateMargin(product.price, costPrice);
                    const productImage = product.images?.[0];
                    const variantCount = allVariants?.filter(v => v.product_id === product.id).length || 0;

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          {productImage ? (
                            <img
                              src={productImage}
                              alt={product.name}
                              className="w-12 h-12 rounded-md object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                              <Image className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            {variantCount > 0 && (
                              <div className="text-xs text-muted-foreground">{variantCount} {variantCount === 1 ? 'cor' : 'cores'}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{(product as any).categories?.name || '-'}</TableCell>
                        <TableCell>{supplierName || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {costPrice > 0 ? formatCurrency(costPrice) : '-'}
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(product.price)}</TableCell>
                        <TableCell>
                          {costPrice > 0 ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              margin >= 30 ? 'bg-primary/15 text-primary' :
                              margin >= 15 ? 'bg-secondary/15 text-secondary' :
                              'bg-destructive/15 text-destructive'
                            }`}>
                              {margin.toFixed(1)}%
                            </span>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>{product.stock ?? 0}</TableCell>
                        <TableCell>{getStatusBadge(product)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" asChild title="Ver no site">
                              <a href={`/produto/${product.slug}`} target="_blank" rel="noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(product)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm('Tem certeza que deseja excluir este produto?')) {
                                  deleteMutation.mutate(product.id);
                                }
                              }}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
