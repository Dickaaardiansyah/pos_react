// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi as authModel } from '../features/auth/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
  }, []);

  function login(userData, token) {
    setUser(userData);
    localStorage.setItem('pos_user', JSON.stringify(userData));
    localStorage.setItem('pos_token', token);
  }

  useEffect(() => {
    // Paksa logout jika backend membalas 401 (token kadaluarsa/tidak valid,
    // atau akun dinonaktifkan admin) di mana pun di aplikasi.
    window.addEventListener('pos:unauthorized', logout);
    return () => window.removeEventListener('pos:unauthorized', logout);
  }, [logout]);

  useEffect(() => {
    // Restore session dari localStorage, lalu validasi ke backend supaya
    // data role selalu yang terbaru (mis. jika admin baru saja mengubahnya).
    const stored = localStorage.getItem('pos_user');
    const token = localStorage.getItem('pos_token');
    if (!stored || !token) {
      setLoading(false);
      return;
    }
    try {
      setUser(JSON.parse(stored));
    } catch {}

    authModel
      .me()
      .then((res) => {
        setUser(res.data);
        localStorage.setItem('pos_user', JSON.stringify(res.data));
      })
      .catch(() => {
        // authModel.me() yang gagal karena 401 sudah memicu event
        // 'pos:unauthorized' di httpClient, jadi logout otomatis terjadi.
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}