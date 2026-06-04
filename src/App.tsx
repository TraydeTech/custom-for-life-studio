import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { TestModeBanner } from "@/components/TestModeBanner";
import ScrollToTop from "./components/ScrollToTop";
import { lazy, Suspense } from "react";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function AppContent() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <ScrollToTop />
      <TestModeBanner />
      <WhatsAppButton />
      <Routes>
        {/* Rotas admin sempre acessíveis */}
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
        <Route path="*" element={<NotFound />} />
      </Routes>
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
