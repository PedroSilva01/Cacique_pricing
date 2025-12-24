
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header';

function MainApp() {
  return (
    <>
      <Helmet>
        <title>Rede Cacique - Sistema de Gestão de Preços</title>
        <meta name="description" content="Plataforma avançada para análise e comparação de preços de combustíveis e fretes em tempo real." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground pb-20 overflow-x-hidden">
        <Header />
        <main className="w-full px-4 py-8">
          <Outlet />
        </main>
      </div>
    </>
  );
}

export default MainApp;
