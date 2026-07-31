import api from './api';

// ─── User Management ──────────────────────────────────────────────────────────

export const getUsers = (params = {}) =>
  api.get('/admin/users', { params });

export const getUser = (id) =>
  api.get(`/admin/users/${id}`);

export const approveUser = (id, note) =>
  api.patch(`/admin/users/${id}/approve`, { note: note || undefined });

export const rejectUser = (id, note) =>
  api.patch(`/admin/users/${id}/reject`, { note: note || undefined });

export const banUser = (id, note) =>
  api.patch(`/admin/users/${id}/ban`, { note: note || undefined });

export const unbanUser = (id, note) =>
  api.patch(`/admin/users/${id}/unban`, { note: note || undefined });

export const unlockUser = (id, note) =>
  api.patch(`/admin/users/${id}/unlock`, { note: note || undefined });

export const deleteUser = (id, note) =>
  api.delete(`/admin/users/${id}`, { data: { note: note || undefined } });

// ─── Super Admin Only ─────────────────────────────────────────────────────────

export const createAdmin = (data) =>
  api.post('/admin/users', data);

export const promoteToAdmin = (id, data) =>
  api.patch(`/admin/users/${id}/promote`, data);

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const getAdminLogs = (params = {}) =>
  api.get('/admin/logs', { params });
