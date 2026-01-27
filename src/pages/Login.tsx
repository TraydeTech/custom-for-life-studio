import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function Login() {
  const { user, loading, adminChecked } = useAuth();

  // Mostrar loading enquanto verifica autenticação OU enquanto verifica admin
  // Isso evita que o formulário apareça brevemente antes da verificação
  if (loading || !adminChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <LoginForm />
      </main>
      <Footer />
    </div>
  );
}
