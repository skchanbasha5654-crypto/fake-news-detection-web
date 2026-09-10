import axios from 'axios';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV
	? 'http://localhost:5000/api'
	: 'https://fake-news-detection-web-c41r.vercel.app/api');
export const api = axios.create({ baseURL: apiBaseUrl });
api.interceptors.request.use((config) => { const token = localStorage.getItem('veritas_token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });