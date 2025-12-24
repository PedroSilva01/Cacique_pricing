
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from '@/components/Auth';
import MainApp from '@/components/MainApp';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { RefreshCw } from 'lucide-react';
import VolumeAnalytics from './pages/VolumeAnalytics';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import PriceEntry from './pages/PriceEntry';
import PriceEdit from './pages/PriceEdit';
import GroupPrices from './pages/GroupPrices';
import PurchaseOrders from './pages/PurchaseOrders';
import FinancialDashboard from './pages/FinancialDashboard';
import SettingsPage from './pages/SettingsPage';
import FreightDetail from './pages/FreightDetail';
import { PriceEntryProvider } from './contexts/PriceEntryContext';

function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <RefreshCw className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      {!session ? (
        <>
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<Navigate to="/auth" />} />
        </>
      ) : (
        <Route path="/" element={<MainApp />}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="price-entry" element={
            <PriceEntryProvider>
              <PriceEntry />
            </PriceEntryProvider>
          } />
          <Route path="price-edit" element={<PriceEdit />} />
          <Route path="group-prices" element={<GroupPrices />} />
          <Route path="purchase-orders" element={<PurchaseOrders />} />
          <Route path="financial-dashboard" element={<FinancialDashboard />} />
          <Route path="volume-analytics" element={<VolumeAnalytics />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="freight-detail" element={<FreightDetail />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>
      )}
    </Routes>
  );
}

export default App;
