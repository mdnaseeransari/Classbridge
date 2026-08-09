import { io } from 'socket.io-client';
import storage from './storage';

const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api')
  .replace('/api', ''); // Extract base domain/port from EXPO_PUBLIC_API_URL

let socket = null;

export const connectSocket = async (onConnectedChange) => {
  try {
    if (socket && socket.connected) {
      if (onConnectedChange) onConnectedChange(true);
      return socket;
    }

    if (socket) {
      socket.disconnect();
    }

    const token = await storage.getItem('userToken');
    if (!token) return null;

    socket = io(SOCKET_URL, {
      auth: { token },
      // 'websocket' is preferred; 'polling' is the fallback for web environments
      // where a direct WebSocket upgrade may be blocked by the browser, proxy, or CORS.
      // Removing 'polling' causes a silent connection failure on web.
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('[SOCKET] Connected:', socket.id);
      if (onConnectedChange) onConnectedChange(true);
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected');
      if (onConnectedChange) onConnectedChange(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[SOCKET] Connection Error:', err.message);
      if (onConnectedChange) onConnectedChange(false);
    });

    return socket;
  } catch (err) {
    console.error('[SOCKET] Init Error:', err);
    return null;
  }
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
