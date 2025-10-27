
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from '@/components/Auth';
import MainApp from '@/components/MainApp';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { RefreshCw } from 'lucide-react';
import Dashboard from '@/pages/Dashboard';
import Analysis from '@/pages/Analysis';
import PriceEntry from '@/pages/PriceEntry';
import SettingsPage from '@/pages/SettingsPage';

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
          <Route path="price-entry" element={<PriceEntry />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>
      )}
    </Routes>
  );
}

export default App;
