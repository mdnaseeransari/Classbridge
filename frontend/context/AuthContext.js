import React, { createContext, useState, useEffect } from 'react';
import storage from '../services/storage';
import api from '../services/api';
import * as Notifications from 'expo-notifications';

export const AuthContext = createContext();

// ── normalizeUser ─────────────────────────────────────────────────────────────
// The backend has two shapes for the user object:
//   • safeUserResponse() (login) → { id, name, role, ... }   (no _id)
//   • getMe() (checkAuth)        → { _id, name, role, ... }  (no id)
// All frontend code compares against user?._id.  This helper ensures _id is
// always present regardless of which path populated the state.
function normalizeUser(u) {
  if (!u) return null;
  const _id = u._id ?? u.id;      // prefer _id, fall back to id
  return { ...u, _id: String(_id), id: String(_id) };
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [requiresPinChange, setRequiresPinChange] = useState(false);
  const [loading, setLoading] = useState(true);

  const registerPushToken = async () => {
    try {
      if (!Notifications || typeof Notifications.getPermissionsAsync !== 'function') {
        return;
      }
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('[PUSH] Permission not granted for push notifications.');
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const tokenVal = tokenData.data;

      if (tokenVal) {
        await api.post('/auth/push-token', { token: tokenVal });
        console.log('[PUSH] Registered token successfully:', tokenVal);
      }
    } catch (err) {
      console.warn('[PUSH] Failed to register push token:', err.message);
    }
  };

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
        const normalized = normalizeUser(res.data.user);
        setUser(normalized);
        setRequiresPinChange(!!normalized?.requiresPinChange);
        registerPushToken();
      } else {
        setToken(null);
        setUser(null);
        setRequiresPinChange(false);
      }
    } catch (err) {
      console.error('[AUTH_CONTEXT] Auth restore failed:', err?.response?.data || err.message);
      // Token invalid or expired — clear stored state
      await storage.deleteItem('userToken');
      setToken(null);
      setUser(null);
      setRequiresPinChange(false);
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
      const { token: newToken, user: userData, requiresPinChange: pinChange } = res.data;
      await storage.setItem('userToken', newToken);
      setToken(newToken);
      setUser(normalizeUser(userData));
      setRequiresPinChange(!!pinChange);
      registerPushToken();
      return { success: true, user: normalizeUser(userData), requiresPinChange: !!pinChange };
    } catch (err) {
      const errorMessage = err?.response?.data?.error || (err?.code === 'ECONNABORTED' ? 'Server is waking up. Please try again in a few seconds.' : 'Login failed. Server is starting up or network unavailable.');
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
      setUser(normalizeUser(userData));
      setRequiresPinChange(false);
      registerPushToken();
      return { success: true, user: normalizeUser(userData) };
    } catch (err) {
      const errorMessage = err?.response?.data?.error || (err?.code === 'ECONNABORTED' ? 'Server is waking up. Please try again in a few seconds.' : 'Admin login failed. Server is starting up or network unavailable.');
      return { success: false, error: errorMessage };
    }
  };

  // Self-signup for Teacher / Student
  const signup = async (signupData) => {
    try {
      const res = await api.post('/auth/signup', signupData);
      return { success: true, message: res.data.message, user: res.data.user };
    } catch (err) {
      const errorMessage = err?.response?.data?.error || (err?.code === 'ECONNABORTED' ? 'Server is waking up. Please try again in a few seconds.' : 'Signup failed. Server is starting up or network unavailable.');
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
      setRequiresPinChange(false);
    }
  };

  const checkPinChangeDone = async () => {
    setRequiresPinChange(false);
    await checkAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        setUser,
        requiresPinChange,
        loading,
        loginTeacherStudent,
        loginAdmin,
        signup,
        logout,
        checkAuth,
        checkPinChangeDone,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
