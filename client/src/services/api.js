import axios from 'axios';
import { supabase } from './supabase.js';
const apiBaseUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000/api/v1' : '/api/v1');
export const api = axios.create({ baseURL: apiBaseUrl, timeout: 15000 });
api.interceptors.request.use(async (config) => { const { data } = await supabase?.auth.getSession() || { data: {} }; const token = data.session?.access_token; if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
api.interceptors.response.use((response) => response, (error) => { const message = error.response?.data?.error?.message || error.message || 'Request failed'; return Promise.reject(new Error(message)); });
