import { createContext, useContext, useEffect, useState } from 'react';

// Tema claro/escuro. Fica salvo no aparelho; o padrão é o escuro.
const ThemeContext = createContext({ theme: 'dark', isDark: true, toggleTheme: () => {} });

const readTheme = () => {
  try {
    return localStorage.getItem('vs-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('vs-theme', theme); } catch { /* sem armazenamento */ }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// Cores dos gráficos para cada tema
export const chartColors = (isDark) => ({
  grid: isDark ? '#22223a' : '#e6e4f0',
  axis: isDark ? '#2a2a42' : '#d6d3e3',
  tick: isDark ? '#9a9ab3' : '#6b6b85',
  dotStroke: isDark ? '#0e0e1a' : '#ffffff',
});
