import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import {
  ThemeProvider as MuiThemeProvider,
  createTheme,
  CssBaseline,
} from '@mui/material';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('podwave_theme');
      return stored === 'light' || stored === 'dark' ? stored : 'dark';
    } catch {
      return 'dark';
    }
  });

  // MUI receives the same light/dark value as the existing CSS theme.
  // This keeps the original ThemeContext while allowing MUI controls to match it.
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme,
          primary: { main: '#E3A64B', contrastText: '#1A1300' },
          secondary: { main: '#4FD1C5' },
          error: { main: theme === 'dark' ? '#E36B6B' : '#B53C3C' },
          background:
            theme === 'dark'
              ? { default: '#0D1017', paper: '#161B24' }
              : { default: '#F7F6F3', paper: '#FFFFFF' },
        },
        typography: {
          fontFamily: "'Inter', sans-serif",
          button: { textTransform: 'none', fontWeight: 600 },
        },
        shape: { borderRadius: 8 },
      }),
    [theme]
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('podwave_theme', theme);
    } catch {
      console.warn('Could not save the selected theme.');
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
