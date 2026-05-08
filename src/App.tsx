import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import EsqueciSenha from "./pages/EsqueciSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import Loja from "./pages/Loja";
import Produto from "./pages/Produto";
import Carrinho from "./pages/Carrinho";
import Checkout from "./pages/Checkout";
import PedidoConfirmado from "./pages/PedidoConfirmado";
import MinhaConta from "./pages/MinhaConta";
import MeusPedidos from "./pages/MeusPedidos";
import MeusEnderecos from "./pages/MeusEnderecos";
import MeusChamados from "./pages/MeusChamados";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProdutos from "./pages/admin/Produtos";
import AdminCategorias from "./pages/admin/Categorias";
import AdminPedidos from "./pages/admin/Pedidos";
import AdminClientes from "./pages/admin/Clientes";
import AdminPDV from "./pages/admin/PDV";
import AdminFinanceiro from "./pages/admin/Financeiro";
import AdminFornecedores from "./pages/admin/Fornecedores";
import AdminRelatorios from "./pages/admin/Relatorios";
import AdminChamados from "./pages/admin/Chamados";
import AdminGestaoPedidos from "./pages/admin/GestaoPedidos";

const queryClient = new QueryClient();

function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  return (
    <>
      {!isAdmin && <WhatsAppButton />}
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/loja" element={<Loja />} />
        <Route path="/produto/:slug" element={<Produto />} />
        <Route path="/carrinho" element={<Carrinho />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/pedido-confirmado" element={<PedidoConfirmado />} />
        <Route path="/minha-conta" element={<MinhaConta />} />
        <Route path="/minha-conta/pedidos" element={<MeusPedidos />} />
        <Route path="/minha-conta/enderecos" element={<MeusEnderecos />} />
        <Route path="/minha-conta/chamados" element={<MeusChamados />} />
        {/* Admin Routes */}
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
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
