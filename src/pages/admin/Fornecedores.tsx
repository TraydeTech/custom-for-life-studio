import { useState } from 'react';
import { CRUDModule } from '@/components/admin/CRUDModule';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tables } from '@/integrations/supabase/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Supplier = Tables<'suppliers'>;

export default function AdminFornecedores() {
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);
  const [isLoadingCNPJ, setIsLoadingCNPJ] = useState(false);

  const fetchAddressByCEP = async (cep: string, formData: any, setFormData: any) => {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length !== 8) return;
    setIsLoadingCEP(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData({
          ...formData,
          street: data.logradouro || formData.street,
          neighborhood: data.bairro || formData.neighborhood,
          city: data.localidade || formData.city,
          state: data.uf || formData.state,
        });
      }
    } catch (e) {
      toast.error('Erro ao buscar CEP');
    } finally {
      setIsLoadingCEP(false);
    }
  };

  const fetchCompanyByCNPJ = async (cnpj: string, formData: any, setFormData: any) => {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length !== 14) return;
    setIsLoadingCNPJ(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      if (res.ok) {
        const data = await res.json();
        setFormData({
          ...formData,
          name: data.razao_social || formData.name,
          email: data.email || formData.email,
          phone: data.ddd_telefone_1 || formData.phone,
          street: data.logradouro || formData.street,
          number: data.numero || formData.number,
          neighborhood: data.bairro || formData.neighborhood,
          city: data.municipio || formData.city,
          state: data.uf || formData.state,
          zip_code: data.cep || formData.zip_code,
        });
      }
    } catch (e) {
      toast.error('Erro ao buscar CNPJ');
    } finally {
      setIsLoadingCNPJ(false);
    }
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <CRUDModule<Supplier>
          title="Fornecedores"
          tableName="suppliers"
          queryKey="admin-suppliers"
          searchPlaceholder="Buscar por nome, e-mail ou CNPJ..."
          searchFields={['name', 'email', 'cnpj', 'cpf', 'contact_name']}
          formClassName="max-w-2xl max-h-[90vh]"
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
          customForm={(formData, setFormData) => (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6 pt-4 pb-8">
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">Dados da Empresa</h3>
                  <div className="space-y-2">
                    <Label>Nome/Razão Social *</Label>
                    <Input 
                      value={formData.name || ''} 
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>CNPJ</Label>
                      <div className="relative">
                        <Input 
                          value={formData.cnpj || ''} 
                          onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                          onBlur={(e) => fetchCompanyByCNPJ(e.target.value, formData, setFormData)}
                        />
                        {isLoadingCNPJ && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <Input 
                        value={formData.cpf || ''} 
                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">Contato</h3>
                  <div className="space-y-2">
                    <Label>Nome do Contato</Label>
                    <Input 
                      value={formData.contact_name || ''} 
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Input 
                        type="email"
                        value={formData.email || ''} 
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input 
                        value={formData.phone || ''} 
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">Endereço</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <div className="relative">
                        <Input 
                          value={formData.zip_code || ''} 
                          onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                          onBlur={(e) => fetchAddressByCEP(e.target.value, formData, setFormData)}
                        />
                        {isLoadingCEP && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Rua</Label>
                      <Input 
                        value={formData.street || ''} 
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Número</Label>
                      <Input 
                        value={formData.number || ''} 
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bairro</Label>
                      <Input 
                        value={formData.neighborhood || ''} 
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input 
                        value={formData.city || ''} 
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Input 
                        value={formData.state || ''} 
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <Label>Observações</Label>
                  <Textarea 
                    value={formData.notes || ''} 
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
            </ScrollArea>
          )}
        />
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
