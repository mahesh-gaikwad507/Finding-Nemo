/**
 * Axios instance and API helpers for Finding Nemo Quiz Adventure.
 */
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  me: () => api.get('/api/auth/me'),
};

// ── Quiz ──────────────────────────────────────────────────────────────────────
export const quizAPI = {
  start: (category) => api.post('/api/quiz/start', { category }),
  state: (attemptId) => api.get(`/api/quiz/state/${attemptId}`),
  answer: (attemptId, data) => api.post(`/api/quiz/answer/${attemptId}`, data),
  result: (attemptId) => api.get(`/api/quiz/result/${attemptId}`),
  abandon: (attemptId) => api.post(`/api/quiz/abandon/${attemptId}`),
  revealClue: (attemptId) => api.post(`/api/quiz/reveal-clue/${attemptId}`),
  domainStatus: () => api.get('/api/quiz/domain-status'),
  resetDomain: () => api.post('/api/quiz/reset-domain'),
};

// ── Leaderboard ───────────────────────────────────────────────────────────────
export const leaderboardAPI = {
  category: (category, limit = 50) =>
    api.get(`/api/leaderboard/category/${category}`, { params: { limit } }),
  overall: (limit = 50) => api.get('/api/leaderboard/overall', { params: { limit } }),
  myRank: (category) => api.get(`/api/leaderboard/rank/${category}`),
};

// ── User ──────────────────────────────────────────────────────────────────────
export const userAPI = {
  profile: () => api.get('/api/user/profile'),
};

// ── Multiplayer Rooms ─────────────────────────────────────────────────────────
export const roomAPI = {
  create: (data) => api.post('/api/rooms/create', data),
  join: (data) => api.post('/api/rooms/join', data),
  setTeam: (roomCode, teamName) => api.post(`/api/rooms/${roomCode}/team`, { team_name: teamName }),
  get: (roomCode) => api.get(`/api/rooms/${roomCode}`),
  start: (roomCode) => api.post(`/api/rooms/${roomCode}/start`),
  answer: (roomCode, data) => api.post(`/api/rooms/${roomCode}/answer`, data),
  leave: (roomCode) => api.post(`/api/rooms/${roomCode}/leave`),
  releaseLeaderboard: (roomCode) => api.post(`/api/rooms/${roomCode}/release_leaderboard`),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminAPI = {
  status: () => api.get('/api/admin/status'),
  startGame: () => api.post('/api/admin/start-game'),
  resetGame: () => api.post('/api/admin/reset-game'),
  clearTeams: () => api.post('/api/admin/clear-teams'),
  getTeams: () => api.get('/api/admin/teams'),
  downloadExcel: () => api.get('/api/admin/export-excel', { responseType: 'blob' }),
};


