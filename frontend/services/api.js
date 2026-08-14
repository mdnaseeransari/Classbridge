import axios from 'axios';
import storage from './storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://classbridge-backend.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
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

// Response interceptor: auto-retry on network errors or cold starts (timeout / 502 / 503)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config || config._retryCount >= 2) {
      return Promise.reject(error);
    }
    // Retry if network error, timeout, or server cold-starting (502, 503, 504)
    if (!error.response || error.code === 'ECONNABORTED' || (error.response && error.response.status >= 500)) {
      config._retryCount = (config._retryCount || 0) + 1;
      console.log(`[API] Network error or cold start detected. Retrying (${config._retryCount}/2)...`);
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return api(config);
    }
    return Promise.reject(error);
  }
);

export default api;
