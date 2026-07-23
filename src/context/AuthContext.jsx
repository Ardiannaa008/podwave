import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// Creates a mock token string without needing a real backend for this MVP.
function makeFakeToken() {
  return `podwave.${Date.now()}.${Math.random().toString(16).slice(2)}.mock`;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('podwave_user');
      const parsed = stored ? JSON.parse(stored) : null;
      return parsed &&
        typeof parsed === 'object' &&
        typeof parsed.username === 'string' &&
        typeof parsed.token === 'string'
        ? parsed
        : null;
    } catch {
      // Corrupted or manually-edited localStorage shouldn't crash the app —
      // just treat it as "not logged in" and let the user log in again.
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) localStorage.setItem('podwave_user', JSON.stringify(user));
      else localStorage.removeItem('podwave_user');
    } catch {
      // Mock login still works for this session if browser storage is blocked.
      console.warn('Could not update the saved Podwave login.');
    }
  }, [user]);

  function login(username) {
    const token = makeFakeToken();
    setUser({ username, token });
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
