
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header';

function MainApp() {
  return (
    <>
      <Helmet>
        <title>Fuel Price Analyzer - Análise Inteligente de Combustíveis</title>
        <meta name="description" content="Plataforma avançada para análise e comparação de preços de combustíveis e fretes em tempo real." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground pb-20">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <Outlet />
        </main>
      </div>
    </>
  );
}

export default MainApp;
