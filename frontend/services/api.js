import axios from 'axios';
import storage from './storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://classbridge-backend.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor: attach Bearer token if present in secure storage
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('[API] Error reading token from storage:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
