import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, Phone, MapPin, Home, Building, Calendar, Building2 } from 'lucide-react';
import { z } from 'zod';
import { parse, isValid, format } from 'date-fns';

type PersonType = 'fisica' | 'juridica';

const baseSchema = {
  fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
  phone: z.string().min(10, 'Telefone inválido').max(15),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
  zipCode: z.string().min(8, 'CEP inválido').max(9),
  street: z.string().min(3, 'Rua obrigatória').max(200),
  number: z.string().min(1, 'Número obrigatório').max(10),
  complement: z.string().max(100).optional(),
  neighborhood: z.string().min(2, 'Bairro obrigatório').max(100),
  city: z.string().min(2, 'Cidade obrigatória').max(100),
  state: z.string().min(2, 'Estado obrigatório').max(2),
};

const fisicaSchema = z.object({
  ...baseSchema,
  cpf: z.string().min(11, 'CPF inválido').max(14),
  birthDate: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

const juridicaSchema = z.object({
  ...baseSchema,
  cnpj: z.string().min(14, 'CNPJ inválido').max(18),
  companyName: z.string().min(3, 'Razão Social obrigatória').max(200),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export function RegisterForm() {
  const [personType, setPersonType] = useState<PersonType>('fisica');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4').trim();
  };

  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5').trim();
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{5})(\d{0,3})/, '$1-$2').trim();
  };

  const formatBirthDate = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return numbers.replace(/(\d{2})(\d{0,2})/, '$1/$2');
    return numbers.replace(/(\d{2})(\d{2})(\d{0,4})/, '$1/$2/$3');
  };

  const parseBirthDateToISO = (dateStr: string): string | null => {
    if (!dateStr || dateStr.length < 10) return null;
    const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
    if (isValid(parsed) && parsed <= new Date() && parsed >= new Date('1900-01-01')) {
      return format(parsed, 'yyyy-MM-dd');
    }
    return null;
  };

  const fetchCompanyByCnpj = async (cnpjValue: string) => {
    const cleanCnpj = cnpjValue.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;

    setLoadingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      const data = await response.json();
      
      if (!data.message) {
        // Preencher dados da empresa
        setCompanyName(data.razao_social || '');
        setFullName(data.nome_fantasia || data.razao_social || '');
        setEmail(data.email || email);
        setPhone(data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1) : phone);
        
        // Preencher endereço
        if (data.cep) {
          setZipCode(formatCep(data.cep));
          setStreet(data.logradouro || '');
          setNumber(data.numero || '');
          setComplement(data.complemento || '');
          setNeighborhood(data.bairro || '');
          setCity(data.municipio || '');
          setState(data.uf || '');
        }
        
        toast({
          title: 'Dados encontrados!',
          description: 'Os dados da empresa foram preenchidos automaticamente.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'CNPJ não encontrado',
          description: 'Verifique o CNPJ informado.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar CNPJ',
        description: 'Não foi possível buscar os dados da empresa.',
      });
    } finally {
      setLoadingCnpj(false);
    }
  };

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setStreet(data.logradouro || '');
        setNeighborhood(data.bairro || '');
        setCity(data.localidade || '');
        setState(data.uf || '');
      } else {
        toast({
          variant: 'destructive',
          title: 'CEP não encontrado',
          description: 'Verifique o CEP informado.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível buscar o endereço.',
      });
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const baseData = {
      fullName, email, phone, password, confirmPassword,
      zipCode, street, number, complement, neighborhood, city, state
    };

    const validation = personType === 'fisica'
      ? fisicaSchema.safeParse({ ...baseData, cpf, birthDate })
      : juridicaSchema.safeParse({ ...baseData, cnpj, companyName });
    
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password, fullName);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar conta',
        description: error.message,
      });
      setLoading(false);
      return;
    }

    // Aguardar um momento para o usuário ser criado
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Buscar o usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Atualizar o perfil
      const profileData = personType === 'fisica'
        ? {
            phone: phone.replace(/\D/g, ''),
            cpf: cpf.replace(/\D/g, ''),
            birth_date: parseBirthDateToISO(birthDate),
            person_type: 'fisica',
          }
        : {
            phone: phone.replace(/\D/g, ''),
            cnpj: cnpj.replace(/\D/g, ''),
            company_name: companyName,
            person_type: 'juridica',
          };

      await supabase
        .from('profiles')
        .update(profileData)
        .eq('user_id', user.id);

      // Criar o endereço padrão
      await supabase
        .from('addresses')
        .insert({
          user_id: user.id,
          zip_code: zipCode.replace(/\D/g, ''),
          street,
          number,
          complement: complement || null,
          neighborhood,
          city,
          state,
          is_default: true,
          label: personType === 'fisica' ? 'Casa' : 'Empresa',
        });
    }

    toast({
      title: 'Conta criada com sucesso!',
      description: 'Bem-vindo à Custom For Life.',
    });
    navigate('/');
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Criar Conta</CardTitle>
        <CardDescription className="text-center">
          Preencha os dados abaixo para criar sua conta
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* Tipo de Pessoa */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Tipo de Cadastro *</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={personType === 'fisica' ? 'default' : 'outline'}
                className="h-16 flex flex-col gap-1"
                onClick={() => setPersonType('fisica')}
              >
                <User className="h-5 w-5" />
                <span>Pessoa Física</span>
              </Button>
              <Button
                type="button"
                variant={personType === 'juridica' ? 'default' : 'outline'}
                className="h-16 flex flex-col gap-1"
                onClick={() => setPersonType('juridica')}
              >
                <Building2 className="h-5 w-5" />
                <span>Pessoa Jurídica</span>
              </Button>
            </div>
          </div>

          {/* Identificação - CPF ou CNPJ primeiro */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {personType === 'fisica' ? (
                <>
                  <User className="h-5 w-5 text-primary" />
                  Dados Pessoais
                </>
              ) : (
                <>
                  <Building2 className="h-5 w-5 text-primary" />
                  Dados da Empresa
                </>
              )}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {personType === 'fisica' ? (
                <>
                  {/* CPF primeiro para Pessoa Física */}
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      type="text"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      maxLength={14}
                      required
                    />
                    {errors.cpf && <p className="text-sm text-destructive">{errors.cpf}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">Data de Nascimento</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="birthDate"
                        type="text"
                        placeholder="29/11/1976"
                        value={birthDate}
                        onChange={(e) => setBirthDate(formatBirthDate(e.target.value))}
                        className="pl-10"
                        maxLength={10}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* CNPJ primeiro para Pessoa Jurídica */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="cnpj">CNPJ * <span className="text-xs text-muted-foreground">(preenche automaticamente)</span></Label>
                    <div className="relative">
                      <Input
                        id="cnpj"
                        type="text"
                        placeholder="00.000.000/0000-00"
                        value={cnpj}
                        onChange={(e) => {
                          const formatted = formatCnpj(e.target.value);
                          setCnpj(formatted);
                          if (formatted.replace(/\D/g, '').length === 14) {
                            fetchCompanyByCnpj(formatted);
                          }
                        }}
                        maxLength={18}
                        required
                      />
                      {loadingCnpj && (
                        <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {errors.cnpj && <p className="text-sm text-destructive">{errors.cnpj}</p>}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="companyName">Razão Social *</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="companyName"
                        type="text"
                        placeholder="Razão Social da Empresa"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                    {errors.companyName && <p className="text-sm text-destructive">{errors.companyName}</p>}
                  </div>
                </>
              )}

              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="fullName">{personType === 'fisica' ? 'Nome Completo *' : 'Nome Fantasia *'}</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder={personType === 'fisica' ? 'Seu nome completo' : 'Nome Fantasia'}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              {/* Telefone */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="phone">Telefone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    className="pl-10"
                    maxLength={15}
                    required
                  />
                </div>
                {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
              </div>
            </div>
          </div>

          {/* Senha */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Senha de Acesso
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirme sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {personType === 'fisica' ? 'Endereço de Entrega' : 'Endereço da Empresa'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zipCode">CEP *</Label>
                <div className="relative">
                  <Input
                    id="zipCode"
                    type="text"
                    placeholder="00000-000"
                    value={zipCode}
                    onChange={(e) => {
                      const formatted = formatCep(e.target.value);
                      setZipCode(formatted);
                      if (formatted.replace(/\D/g, '').length === 8) {
                        fetchAddressByCep(formatted);
                      }
                    }}
                    maxLength={9}
                    required
                  />
                  {loadingCep && (
                    <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {errors.zipCode && <p className="text-sm text-destructive">{errors.zipCode}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="street">Rua/Avenida *</Label>
                <div className="relative">
                  <Home className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="street"
                    type="text"
                    placeholder="Nome da rua"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                {errors.street && <p className="text-sm text-destructive">{errors.street}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="number">Número *</Label>
                <Input
                  id="number"
                  type="text"
                  placeholder="123"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  required
                />
                {errors.number && <p className="text-sm text-destructive">{errors.number}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  type="text"
                  placeholder="Apto, bloco, etc. (opcional)"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro *</Label>
                <Input
                  id="neighborhood"
                  type="text"
                  placeholder="Bairro"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  required
                />
                {errors.neighborhood && <p className="text-sm text-destructive">{errors.neighborhood}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade *</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="city"
                    type="text"
                    placeholder="Cidade"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado *</Label>
                <Input
                  id="state"
                  type="text"
                  placeholder="UF"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  maxLength={2}
                  required
                />
                {errors.state && <p className="text-sm text-destructive">{errors.state}</p>}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Conta
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Entre aqui
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
