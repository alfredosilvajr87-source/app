import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = "https://app-dupa.onrender.com";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
      // Fetch company details
      if (res.data.company_id) {
        const companyRes = await axios.get(`${API}/companies/${res.data.company_id}`);
        setCompany(companyRes.data);
      }
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    // Fetch company
    if (userData.company_id) {
      const companyRes = await axios.get(`${API}/companies/${userData.company_id}`);
      setCompany(companyRes.data);
    }
    return userData;
  };

  const registerFirst = async (email, password, name, companyName) => {
    const res = await axios.post(`${API}/auth/register-first?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&name=${encodeURIComponent(name)}&company_name=${encodeURIComponent(companyName)}`);
    const { token: newToken, user: userData, company: companyData } = res.data;
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    setCompany(companyData);
    return userData;
  };

  const register = async (email, password, name, companyId) => {
    const res = await axios.post(`${API}/auth/register`, { email, password, name, company_id: companyId });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setCompany(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    await axios.put(`${API}/auth/password`, { current_password: currentPassword, new_password: newPassword });
  };

  const updateCompany = (newCompany) => {
    setCompany(newCompany);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ 
      user, 
      company, 
      token, 
      loading, 
      isAdmin,
      login, 
      register, 
      registerFirst,
      logout,
      changePassword,
      updateCompany,
      refreshUser: fetchUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
