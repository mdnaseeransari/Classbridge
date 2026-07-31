import React, { createContext, useState, useEffect } from 'react';
import storage from '../services/storage';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for stored token on app launch
  const checkAuth = async () => {
    try {
      setLoading(true);
      const storedToken = await storage.getItem('userToken');
      if (storedToken) {
        setToken(storedToken);
        // Verify token & fetch user profile
        const res = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        setUser(res.data.user);
      } else {
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('[AUTH_CONTEXT] Auth restore failed:', err?.response?.data || err.message);
      // Token invalid or expired — clear stored state
      await storage.deleteItem('userToken');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Login action for Teacher / Student
  const loginTeacherStudent = async (phone, pin) => {
    try {
      const res = await api.post('/auth/login/teacher-student', { phone, pin });
      const { token: newToken, user: userData } = res.data;
      await storage.setItem('userToken', newToken);
      setToken(newToken);
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const errorMessage = err?.response?.data?.error || 'Login failed. Please check your network connection.';
      return { success: false, error: errorMessage };
    }
  };

  // Login action for Admin / Super Admin
  const loginAdmin = async (email, password) => {
    try {
      const res = await api.post('/auth/login/admin', { email, password });
      const { token: newToken, user: userData } = res.data;
      await storage.setItem('userToken', newToken);
      setToken(newToken);
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const errorMessage = err?.response?.data?.error || 'Admin login failed. Please try again.';
      return { success: false, error: errorMessage };
    }
  };

  // Self-signup for Teacher / Student
  const signup = async (signupData) => {
    try {
      const res = await api.post('/auth/signup', signupData);
      return { success: true, message: res.data.message, user: res.data.user };
    } catch (err) {
      const errorMessage = err?.response?.data?.error || 'Signup failed. Please try again.';
      return { success: false, error: errorMessage };
    }
  };

  // Logout action
  const logout = async () => {
    try {
      await storage.deleteItem('userToken');
    } catch (e) {
      console.error('[AUTH_CONTEXT] Error clearing token:', e);
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        loginTeacherStudent,
        loginAdmin,
        signup,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
