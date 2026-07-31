import { io } from 'socket.io-client';
import storage from './storage';

const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api')
  .replace('/api', ''); // Extract base domain/port from EXPO_PUBLIC_API_URL

let socket = null;

export const connectSocket = async (onConnectedChange) => {
  try {
    if (socket) {
      socket.disconnect();
    }

    const token = await storage.getItem('userToken');
    if (!token) return null;

    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
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
