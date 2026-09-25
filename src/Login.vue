<template>
  <div class="login-container">
    <div class="login-box">
      <h2>🛡️ NetPilot 登录</h2>

      <div class="tab">
        <div :class="['tab-item', { active: mode === 'login' }]" @click="mode = 'login'">登录</div>
        <div :class="['tab-item', { active: mode === 'register' }]" @click="mode = 'register'">注册</div>
      </div>

      <div class="form-group">
        <label>用户名</label>
        <input v-model="form.username" placeholder="请输入用户名" />
      </div>
      <div class="form-group">
        <label>密码</label>
        <input v-model="form.password" type="password" placeholder="请输入密码" @keyup.enter="submit" />
      </div>

      <button class="submit-btn" @click="submit" :disabled="loading">
        {{ loading ? '处理中...' : (mode === 'login' ? '登录' : '注册') }}
      </button>

      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      <div v-if="successMsg" class="success-msg">{{ successMsg }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import axios from 'axios';

const emit = defineEmits(['login-success']);

const mode = ref('login'); // login | register
const form = reactive({ username: '', password: '' });
const loading = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

const submit = async () => {
  errorMsg.value = '';
  successMsg.value = '';
  if (!form.username || !form.password) {
    errorMsg.value = '用户名和密码不能为空';
    return;
  }
  loading.value = true;
  try {
    if (mode.value === 'register') {
      const res = await axios.post('http://localhost:8080/api/auth/register', form);
      if (res.data.success) {
        successMsg.value = '注册成功，请登录';
        mode.value = 'login';
      }
    } else {
      const res = await axios.post('http://localhost:8080/api/auth/login', form);
      // 后端返回 LoginResponse: { token, username, role }
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('username', res.data.username);
      localStorage.setItem('role', res.data.role);
      emit('login-success');
    }
  } catch (e) {
    console.error(e);
    if (e.response?.status === 401 || e.response?.status === 403) {
      errorMsg.value = '用户名或密码错误';
    } else if (e.response?.data?.message) {
      errorMsg.value = e.response.data.message;
    } else {
      errorMsg.value = '请求失败：' + e.message;
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: 'Segoe UI', sans-serif;
}
.login-box {
  background: white;
  padding: 40px;
  border-radius: 16px;
  width: 380px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
h2 { text-align: center; color: #333; margin-bottom: 25px; }
.tab { display: flex; margin-bottom: 20px; border-bottom: 1px solid #eee; }
.tab-item { flex: 1; text-align: center; padding: 10px; cursor: pointer; color: #999; }
.tab-item.active { color: #667eea; border-bottom: 2px solid #667eea; font-weight: bold; }
.form-group { margin-bottom: 15px; }
.form-group label { display: block; font-size: 14px; color: #555; margin-bottom: 5px; }
.form-group input {
  width: 100%; padding: 12px; border: 1px solid #ddd;
  border-radius: 8px; font-size: 15px; box-sizing: border-box;
  outline: none; transition: border 0.3s;
}
.form-group input:focus { border-color: #667eea; }
.submit-btn {
  width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea, #764ba2);
  color: white; border: none; border-radius: 8px; font-size: 16px;
  cursor: pointer; margin-top: 10px; transition: opacity 0.3s;
}
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.error-msg { color: #dc3545; text-align: center; margin-top: 12px; font-size: 14px; }
.success-msg { color: #28a745; text-align: center; margin-top: 12px; font-size: 14px; }
</style>