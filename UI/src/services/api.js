import axios from 'axios';
import { API_CONFIG, AUTH_CONFIG } from '@/config/constants';

const api = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});


api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const jiraApi = axios.create({
  baseURL: API_CONFIG.jiraURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

if (AUTH_CONFIG.jiraEmail && AUTH_CONFIG.jiraToken) {
  jiraApi.defaults.headers.common['Authorization'] = 
    `Basic ${btoa(`${AUTH_CONFIG.jiraEmail}:${AUTH_CONFIG.jiraToken}`)}`;
}

export default api;
