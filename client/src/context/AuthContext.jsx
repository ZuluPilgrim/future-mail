/**
 * AuthContext — Global Authentication State
 *
 * Provides the current user and auth helpers to the entire React app
 * via context. Persists the JWT token and user info in localStorage
 * so sessions survive page refreshes.
 *
 * Exposes via useAuth():
 *   user      — current user object { id, name, email, role } or null
 *   isAdmin   — true if user.role === 'admin'
 *   loading   — true while reading from localStorage on mount
 *   login()   — saves token + user, sets state
 *   logout()  — clears token + user, sets state to null
 *
 * authHeaders() is a standalone helper that returns the Authorization
 * header object needed for authenticated API calls.
 */
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from localStorage on first mount
  useEffect(() => {
    const token     = localStorage.getItem('fm_token');
    const savedUser = localStorage.getItem('fm_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('fm_token', token);
    localStorage.setItem('fm_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('fm_token');
    localStorage.removeItem('fm_user');
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

/**
 * Returns headers required for authenticated API requests:
 *   { 'Content-Type': 'application/json', 'Authorization': 'Bearer <token>' }
 */
export const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('fm_token')}`,
});
