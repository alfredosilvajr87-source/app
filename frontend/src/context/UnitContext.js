import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const UnitContext = createContext(null);

export const UnitProvider = ({ children }) => {
  const { token, isAdmin } = useAuth();
  const [units, setUnits] = useState([]);
  const [currentUnit, setCurrentUnit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUnits();
    }
  }, [token]);

  const fetchUnits = async () => {
    try {
      const res = await axios.get(`${API}/units`);
      setUnits(res.data);
      
      const savedUnitId = localStorage.getItem('currentUnitId');
      if (res.data.length > 0) {
        const savedUnit = res.data.find(u => u.id === savedUnitId);
        setCurrentUnit(savedUnit || res.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch units:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectUnit = (unit) => {
    setCurrentUnit(unit);
    localStorage.setItem('currentUnitId', unit.id);
  };

  const createUnit = async (data) => {
    const res = await axios.post(`${API}/units`, data);
    setUnits([...units, res.data]);
    if (!currentUnit) {
      selectUnit(res.data);
    }
    return res.data;
  };

  const updateUnit = async (id, data) => {
    const res = await axios.put(`${API}/units/${id}`, data);
    setUnits(units.map(u => u.id === id ? res.data : u));
    if (currentUnit?.id === id) {
      setCurrentUnit(res.data);
    }
    return res.data;
  };

  const deleteUnit = async (id) => {
    await axios.delete(`${API}/units/${id}`);
    const newUnits = units.filter(u => u.id !== id);
    setUnits(newUnits);
    if (currentUnit?.id === id && newUnits.length > 0) {
      selectUnit(newUnits[0]);
    }
  };

  return (
    <UnitContext.Provider value={{
      units,
      currentUnit,
      loading,
      selectUnit,
      createUnit,
      updateUnit,
      deleteUnit,
      refreshUnits: fetchUnits
    }}>
      {children}
    </UnitContext.Provider>
  );
};

export const useUnit = () => {
  const context = useContext(UnitContext);
  if (!context) throw new Error('useUnit must be used within UnitProvider');
  return context;
};
