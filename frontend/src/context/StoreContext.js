import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { formatMoney } from '../lib/store';

import { API_URL as API } from '../config';

const StoreContext = createContext(null);

const DEFAULT_SETTINGS = {
  currency: 'BRL', tax_id: '', address: '', phone: '', email: '', invoice_footer: '',
};

export const StoreProvider = ({ children }) => {
  const { token } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/settings`);
      setSettings({ ...DEFAULT_SETTINGS, ...res.data });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, []);

  useEffect(() => {
    if (token) refreshSettings();
  }, [token, refreshSettings]);

  const money = useCallback((value) => formatMoney(value, settings.currency), [settings.currency]);

  return (
    <StoreContext.Provider value={{ settings, setSettings, refreshSettings, money }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};
