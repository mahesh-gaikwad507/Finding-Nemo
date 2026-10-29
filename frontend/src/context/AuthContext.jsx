/**
 * Auth context — provides user state, login, logout helpers app-wide.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, try to restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    authAPI.me()
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (identifier, password) => {
    const payload = typeof identifier === 'object' ? identifier : { username: identifier, password };
    const res = await authAPI.login(payload);
    localStorage.setItem('token', res.data.access_token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async (dataOrUsername, email, password) => {
    const payload = typeof dataOrUsername === 'object'
      ? dataOrUsername
      : {
          team_name: dataOrUsername,
          leader_name: dataOrUsername,
          phone_number: '9999999999',
          username: dataOrUsername,
          email: email || `${dataOrUsername}@ocean.local`,
          password,
        };
    const res = await authAPI.register(payload);
    localStorage.setItem('token', res.data.access_token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authAPI.me();
      setUser(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
