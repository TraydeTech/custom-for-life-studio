import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { BottomNav } from "@/components/layout/BottomNav";
import ScrollToTop from "./components/ScrollToTop";
import { lazy, Suspense, useEffect } from "react";
import { isNativeApp, initNative } from "@/lib/native";

// Admin pages (lazy loaded)
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminProdutos = lazy(() => import("./pages/admin/Produtos"));
const AdminCategorias = lazy(() => import("./pages/admin/Categorias"));
const AdminPedidos = lazy(() => import("./pages/admin/Pedidos"));
const AdminClientes = lazy(() => import("./pages/admin/Clientes"));
const AdminPDV = lazy(() => import("./pages/admin/PDV"));
const AdminFinanceiro = lazy(() => import("./pages/admin/Financeiro"));
const AdminFornecedores = lazy(() => import("./pages/admin/Fornecedores"));
const AdminRelatorios = lazy(() => import("./pages/admin/Relatorios"));
const AdminChamados = lazy(() => import("./pages/admin/Chamados"));
const AdminGestaoPedidos = lazy(() => import("./pages/admin/GestaoPedidos"));

// Public pages (lazy loaded)
const Home = lazy(() => import("./pages/Index"));
const Loja = lazy(() => import("./pages/Loja"));
const Produto = lazy(() => import("./pages/Produto"));
const Carrinho = lazy(() => import("./pages/Carrinho"));
const Checkout = lazy(() => import("./pages/Checkout"));
const PedidoConfirmado = lazy(() => import("./pages/PedidoConfirmado"));
const Login = lazy(() => import("./pages/Login"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const EsqueciSenha = lazy(() => import("./pages/EsqueciSenha"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const MinhaConta = lazy(() => import("./pages/MinhaConta"));
const MeusPedidos = lazy(() => import("./pages/MeusPedidos"));
const MeusEnderecos = lazy(() => import("./pages/MeusEnderecos"));
const MeusChamados = lazy(() => import("./pages/MeusChamados"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const Localizacao = lazy(() => import("./pages/Localizacao"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function AppContent() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isAdmin = pathname.startsWith('/admin');
  // No app publicado nas lojas o painel admin não existe: é ferramenta interna,
  // só acessível pelo site. No navegador o admin continua normal.
  const native = isNativeApp();

  useEffect(() => {
    // Botão "voltar" do Android: volta na navegação enquanto houver histórico
    // dentro do app; na tela inicial deixa o sistema minimizar/fechar.
    initNative(() => {
      if (window.location.pathname !== '/') {
        navigate(-1);
        return true;
      }
      return false;
    });
  }, [navigate]);

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <ScrollToTop />
      {!isAdmin && <WhatsAppButton />}
      <Routes>
        {/* Rotas admin — só no site. No app nativo redirecionam para a home. */}
        {native ? (
          <Route path="/admin/*" element={<Navigate to="/" replace />} />
        ) : (
          <>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/pdv" element={<AdminPDV />} />
            <Route path="/admin/produtos" element={<AdminProdutos />} />
            <Route path="/admin/categorias" element={<AdminCategorias />} />
            <Route path="/admin/pedidos" element={<AdminPedidos />} />
            <Route path="/admin/financeiro" element={<AdminFinanceiro />} />
            <Route path="/admin/clientes" element={<AdminClientes />} />
            <Route path="/admin/fornecedores" element={<AdminFornecedores />} />
            <Route path="/admin/relatorios" element={<AdminRelatorios />} />
            <Route path="/admin/chamados" element={<AdminChamados />} />
            <Route path="/admin/gestao-pedidos" element={<AdminGestaoPedidos />} />
          </>
        )}

        {/* Rotas públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/loja" element={<Loja />} />
        <Route path="/produto/:slug" element={<Produto />} />
        <Route path="/carrinho" element={<Carrinho />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/pedido-confirmado" element={<PedidoConfirmado />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/minha-conta" element={<MinhaConta />} />
        <Route path="/meus-pedidos" element={<MeusPedidos />} />
        <Route path="/meus-enderecos" element={<MeusEnderecos />} />
        <Route path="/meus-chamados" element={<MeusChamados />} />
        {/* Aliases aninhados usados por Header/Footer/AccountLayout/SupportWidget */}
        <Route path="/minha-conta/pedidos" element={<MeusPedidos />} />
        <Route path="/minha-conta/enderecos" element={<MeusEnderecos />} />
        <Route path="/minha-conta/chamados" element={<MeusChamados />} />
        <Route path="/em-breve" element={<ComingSoon />} />
        <Route path="/localizacao" element={<Localizacao />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {/* Barra de abas estilo app — só no app nativo, fora do admin. */}
      {native && !isAdmin && <BottomNav />}
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);


export default App;
