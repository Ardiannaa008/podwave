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

  const tokens = useMemo(
    () =>
      theme === 'dark'
        ? {
            bg: '#0D1017',
            panel: '#161B24',
            border: '#262E3D',
            text: '#EDEEF0',
            textMuted: '#8A93A3',
            gold: '#E3A64B',
            teal: '#4FD1C5',
            danger: '#E36B6B',
            buttonText: '#0D1017',
          }
        : {
            bg: '#F7F6F3',
            panel: '#FFFFFF',
            border: '#E3E0D9',
            text: '#191A1D',
            textMuted: '#6B6F76',
            gold: '#9A5B00',
            teal: '#4FD1C5',
            danger: '#B53C3C',
            buttonText: '#FFFFFF',
          },
    [theme]
  );

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme,
          primary: { main: tokens.gold, contrastText: tokens.buttonText },
          secondary: { main: tokens.teal },
          error: { main: tokens.danger },
          background: { default: tokens.bg, paper: tokens.panel },
          text: { primary: tokens.text, secondary: tokens.textMuted },
          divider: tokens.border,
        },
        typography: {
          fontFamily: 'Inter, sans-serif',
          button: { textTransform: 'none', fontWeight: 600 },
        },
        shape: { borderRadius: 10 },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 10,
                boxShadow: 'none',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
              },
              contained: {
                backgroundColor: 'var(--gold)',
                color: tokens.buttonText,
                '&:hover': {
                  backgroundColor: 'var(--gold)',
                  filter: theme === 'dark' ? 'brightness(1.08)' : 'brightness(0.92)',
                },
                '&.Mui-disabled': {
                  backgroundColor: 'var(--gold-dim)',
                  color: 'var(--text-muted)',
                },
              },
              outlined: {
                borderColor: 'var(--border)',
                color: 'var(--text)',
                '&:hover': {
                  borderColor: 'var(--gold)',
                  backgroundColor: 'color-mix(in srgb, var(--gold) 10%, transparent)',
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                backgroundColor: 'var(--panel)',
                color: 'var(--text)',
              },
            },
          },
          MuiSkeleton: {
            styleOverrides: {
              root: {
                backgroundColor: 'var(--border)',
              },
            },
          },
          MuiAlert: {
            styleOverrides: {
              root: {
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text)',
              },
              standardError: {
                backgroundColor: 'color-mix(in srgb, var(--danger) 16%, var(--panel))',
                '& .MuiAlert-icon': {
                  color: 'var(--danger)',
                },
              },
              standardInfo: {
                backgroundColor: 'color-mix(in srgb, var(--teal) 14%, var(--panel))',
                '& .MuiAlert-icon': {
                  color: 'var(--teal)',
                },
              },
              standardWarning: {
                backgroundColor: 'color-mix(in srgb, var(--gold) 16%, var(--panel))',
                '& .MuiAlert-icon': {
                  color: 'var(--gold)',
                },
              },
            },
          },
          MuiTextField: {
            defaultProps: {
              variant: 'outlined',
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                backgroundColor: 'var(--panel)',
                color: 'var(--text)',
                '& fieldset': {
                  borderColor: 'var(--border)',
                },
                '&:hover fieldset': {
                  borderColor: 'var(--text-muted)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--gold)',
                },
              },
              input: {
                color: 'var(--text)',
              },
            },
          },
          MuiInputLabel: {
            styleOverrides: {
              root: {
                color: 'var(--text-muted)',
                '&.Mui-focused': {
                  color: 'var(--gold)',
                },
              },
            },
          },
          MuiSelect: {
            styleOverrides: {
              icon: {
                color: 'var(--text-muted)',
              },
            },
          },
          MuiTableSortLabel: {
            styleOverrides: {
              root: {
                color: 'var(--text-muted)',
                '&:hover': {
                  color: 'var(--gold)',
                },
                '&.Mui-active': {
                  color: 'var(--gold)',
                  '&& .MuiTableSortLabel-icon': {
                    color: 'var(--gold)',
                  },
                },
              },
            },
          },
        },
      }),
    [theme, tokens]
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
