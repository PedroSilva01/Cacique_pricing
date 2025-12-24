import React, { createContext, useContext, useState, useCallback } from 'react';

const PriceEntryContext = createContext();

export const usePriceEntry = () => {
  const context = useContext(PriceEntryContext);
  if (!context) {
    throw new Error('usePriceEntry must be used within PriceEntryProvider');
  }
  return context;
};

export const PriceEntryProvider = ({ children }) => {
  const [formState, setFormState] = useState({
    date: '',
    selectedBase: null,
    selectedSupplier: null,
    selectedGroups: [],
    prices: {},
    groupSearch: ''
  });

  const updateFormState = useCallback((updates) => {
    setFormState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState({
      date: '',
      selectedBase: null,
      selectedSupplier: null,
      selectedGroups: [],
      prices: {},
      groupSearch: ''
    });
  }, []);

  const value = {
    formState,
    updateFormState,
    resetForm
  };

  return (
    <PriceEntryContext.Provider value={value}>
      {children}
    </PriceEntryContext.Provider>
  );
};

export default PriceEntryContext;
