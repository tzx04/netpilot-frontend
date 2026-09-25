import { createApp } from 'vue';
import App from './App.vue';
import axios from 'axios';

// 全局 Axios 请求拦截器：自动带 Token
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

// 401 自动退出
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      location.reload();
    }
    return Promise.reject(error);
  }
);

createApp(App).mount('#app');