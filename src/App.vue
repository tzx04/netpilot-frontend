<template>
  <Login v-if="!isLoggedIn" @login-success="handleLoginSuccess" />
  <div v-else class="dashboard">
    <div class="header">
      <h1>🛡️ NetPilot 网络管理平台</h1>
      <div class="user-info">
        <span>👤 {{ currentUser }}</span>
        <button @click="logout" class="logout-btn">退出登录</button>
      </div>
    </div>

    <!-- 设备监控面板 -->
    <div class="stats-panel">
      <div class="stat-card">📡 总设备: {{ devices.length }}</div>
      <div class="stat-card">🟢 在线: {{ onlineCount }}</div>
      <div class="stat-card">🔴 离线: {{ offlineCount }}</div>
      <button @click="fetchDevices" class="refresh-btn">刷新设备</button>
      <button @click="openAddDialog" class="add-btn">+ 添加设备</button>
    </div>

    <!-- 设备列表 -->
    <div class="device-list">
      <div v-if="devices.length === 0" class="no-device">暂无设备，点击"添加设备"新增...</div>
      <div v-for="device in devices" :key="device.id" class="device-item">
        <span :class="['status-dot', device.online ? 'online' : 'offline']"></span>
        <strong>{{ device.name }}</strong> ({{ device.ipAddress }})
        <button @click="diagnoseDevice(device)" class="diag-btn">AI 诊断</button>
        <button @click="openDashboard(device)" class="monitor-btn">监控</button>
        <button @click="showHistory(device)" class="history-btn">历史</button>
        <button @click="openEditDialog(device)" class="edit-btn">编辑</button>
        <button @click="deleteDevice(device)" class="delete-btn">删除</button>
      </div>
    </div>

    <!-- AI 助手聊天区 -->
    <div class="chat-container">
      <h2>🤖 AI 网络诊断助手</h2>
      <div class="chat-box" ref="chatBox">
        <div v-for="(msg, index) in messages" :key="index" :class="['message-row', msg.role]">
          <div class="bubble" v-html="renderMarkdown(msg.content)"></div>
        </div>
      </div>
      <div class="input-area">
        <input v-model="inputMessage" @keyup.enter="sendMessage" placeholder="试试输入：诊断设备 1" />
        <button @click="sendMessage">发送</button>
      </div>
    </div>

    <!-- 监控大屏弹窗 -->
    <div v-if="showDashboard" class="modal-mask" @click.self="showDashboard = false">
      <div class="modal-dashboard">
        <Dashboard :device="dashboardDevice" @close="showDashboard = false" />
      </div>
    </div>

    <!-- 历史记录弹窗 -->
    <div v-if="showHistoryDialog" class="modal-mask" @click.self="showHistoryDialog = false">
      <div class="modal">
        <h3>📋 诊断历史记录</h3>
        <div v-if="historyList.length === 0" class="empty-history">暂无历史记录</div>
        <div v-for="h in historyList" :key="h.id" class="history-item">
          <div class="history-time">{{ formatTime(h.createTime) }}</div>
          <div class="history-content" v-html="renderMarkdown(h.diagnosis)"></div>
        </div>
        <button class="close-btn" @click="showHistoryDialog = false">关闭</button>
      </div>
    </div>

    <!-- 添加/编辑设备弹窗 -->
    <div v-if="showFormDialog" class="modal-mask" @click.self="closeFormDialog">
      <div class="modal">
        <h3>{{ isEditMode ? '✏️ 编辑设备' : '➕ 添加设备' }}</h3>
        <div class="form-group">
          <label>设备名称</label>
          <input v-model="formData.name" placeholder="例如：核心交换机-1" />
        </div>
        <div class="form-group">
          <label>IP 地址</label>
          <input v-model="formData.ipAddress" placeholder="例如：192.168.1.1" />
        </div>
        <div class="form-group">
          <label>设备类型</label>
          <input v-model="formData.deviceType" placeholder="例如：HUAWEI / Cisco" />
        </div>
        <div class="form-group">
          <label>SNMP 团体字</label>
          <input v-model="formData.snmpCommunity" placeholder="例如：public" />
        </div>
        <div class="form-group">
          <label>SNMP 版本</label>
          <input v-model="formData.snmpVersion" placeholder="例如：v2c" />
        </div>
        <div class="form-group">
          <label>SSH 用户名（可选）</label>
          <input v-model="formData.sshUsername" placeholder="可选" />
        </div>
        <div class="form-group">
          <label>SSH 密码（可选）</label>
          <input v-model="formData.sshPassword" placeholder="可选" type="password" />
        </div>
        <div class="form-group">
          <label>启用状态</label>
          <select v-model.number="formData.status">
            <option :value="1">启用</option>
            <option :value="0">禁用</option>
          </select>
        </div>
        <div class="form-actions">
          <button class="cancel-btn" @click="closeFormDialog">取消</button>
          <button class="submit-btn" @click="submitForm">{{ isEditMode ? '保存' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import axios from 'axios';
import { marked } from 'marked';
import Login from './Login.vue';
import Dashboard from './Dashboard.vue';

const isLoggedIn = ref(!!localStorage.getItem('token'));
const currentUser = ref(localStorage.getItem('username') || '匿名用户');

const handleLoginSuccess = () => {
  currentUser.value = localStorage.getItem('username') || '匿名用户';
  isLoggedIn.value = true;
  fetchDevices();
};

const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
  isLoggedIn.value = false;
};

const devices = ref([]);
const messages = ref([{ role: 'assistant', content: '你好，我是 NetPilot AI 助手。我可以帮你监控网络状态并诊断设备故障！' }]);
const inputMessage = ref('');
const chatBox = ref(null);

const historyList = ref([]);
const showHistoryDialog = ref(false);

const showDashboard = ref(false);
const dashboardDevice = ref({});

const showFormDialog = ref(false);
const isEditMode = ref(false);
const editingId = ref(null);
const formData = ref({
  name: '',
  ipAddress: '',
  deviceType: 'HUAWEI',
  snmpCommunity: 'public',
  snmpVersion: 'v2c',
  sshUsername: '',
  sshPassword: '',
  status: 1
});

const onlineCount = computed(() => devices.value.filter(d => d.online).length);
const offlineCount = computed(() => devices.value.filter(d => !d.online).length);

const renderMarkdown = (text) => {
  if (!text) return '';
  return marked.parse(text);
};

const fetchDevices = async () => {
  try {
    const res = await axios.get('http://localhost:8080/api/devices');
    devices.value = res.data;
  } catch (e) {
    console.error('获取设备失败', e);
  }
};

// ====== 监控大屏 ======
const openDashboard = (device) => {
  dashboardDevice.value = device;
  showDashboard.value = true;
};

// ====== 设备 CRUD ======
const openAddDialog = () => {
  isEditMode.value = false;
  editingId.value = null;
  formData.value = {
    name: '', ipAddress: '', deviceType: 'HUAWEI',
    snmpCommunity: 'public', snmpVersion: 'v2c',
    sshUsername: '', sshPassword: '', status: 1
  };
  showFormDialog.value = true;
};

const openEditDialog = (device) => {
  isEditMode.value = true;
  editingId.value = device.id;
  formData.value = {
    name: device.name || '',
    ipAddress: device.ipAddress || '',
    deviceType: device.deviceType || '',
    snmpCommunity: device.snmpCommunity || '',
    snmpVersion: device.snmpVersion || '',
    sshUsername: device.sshUsername || '',
    sshPassword: '',
    status: device.status ?? 1
  };
  showFormDialog.value = true;
};

const closeFormDialog = () => {
  showFormDialog.value = false;
};

const submitForm = async () => {
  if (!formData.value.name || !formData.value.ipAddress) {
    alert('设备名称和 IP 地址不能为空！');
    return;
  }
  try {
    if (isEditMode.value) {
      await axios.put(`http://localhost:8080/api/devices/${editingId.value}`, formData.value);
    } else {
      await axios.post('http://localhost:8080/api/devices', formData.value);
    }
    showFormDialog.value = false;
    await fetchDevices();
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
};

const deleteDevice = async (device) => {
  if (!confirm(`确定要删除设备 [${device.name}] 吗？`)) return;
  try {
    await axios.delete(`http://localhost:8080/api/devices/${device.id}`);
    await fetchDevices();
  } catch (e) {
    alert('删除失败: ' + e.message);
  }
};

// ====== AI 诊断 ======
const diagnoseDevice = async (device) => {
  const reply = { role: 'assistant', content: `正在诊断设备 [${device.name}]...` };
  messages.value.push(reply);
  scrollToBottom();
  try {
    const res = await axios.get(`http://localhost:8080/api/ai/diagnose/${device.id}`);
    reply.content = `【${device.name} 诊断报告】\n\n${res.data.diagnosis}`;
  } catch (e) {
    reply.content = `诊断设备 [${device.name}] 失败: ${e.message}`;
  }
  scrollToBottom();
};

const showHistory = async (device) => {
  try {
    const res = await axios.get(`http://localhost:8080/api/ai/history/${device.id}`);
    historyList.value = res.data;
    showHistoryDialog.value = true;
  } catch (e) {
    alert('获取历史记录失败: ' + e.message);
  }
};

const formatTime = (t) => {
  if (!t) return '';
  return new Date(t).toLocaleString('zh-CN');
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
};

// ====== 聊天 ======
const sendMessage = async () => {
  if (!inputMessage.value.trim()) return;
  const question = inputMessage.value;
  messages.value.push({ role: 'user', content: question });
  inputMessage.value = '';

  if (question.includes('诊断')) {
    const deviceNum = question.match(/\d+/);
    if (deviceNum) {
      const device = devices.value.find(d => d.id == deviceNum) || devices.value[0];
      if (device) {
        await diagnoseDevice(device);
        return;
      }
    }
  }

  const aiMsg = { role: 'assistant', content: '' };
  messages.value.push(aiMsg);
  scrollToBottom();

  try {
    const response = await fetch('http://localhost:8080/api/ai/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
      },
      body: JSON.stringify({ message: question })
    });

    if (!response.body) {
      aiMsg.content = '浏览器不支持流式读取。';
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.substring(5).trim();
          if (data && data !== '[DONE]') {
            aiMsg.content += data;
            scrollToBottom();
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
    aiMsg.content = 'AI 连接失败，请检查后端。';
  }
  scrollToBottom();
};

onMounted(() => {
  if (isLoggedIn.value) fetchDevices();
});
</script>

<style scoped>
.dashboard { max-width: 900px; margin: 0 auto; padding: 20px; font-family: sans-serif; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
h1 { color: #333; margin: 0; }
.user-info { display: flex; align-items: center; gap: 10px; color: #555; }
.logout-btn { background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; }

.stats-panel { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.stat-card { flex: 1; padding: 15px; background: #f0f4f8; border-radius: 8px; font-weight: bold; text-align: center; min-width: 100px; }
.refresh-btn { padding: 0 15px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; }
.add-btn { padding: 0 15px; background: #ff9800; color: white; border: none; border-radius: 8px; cursor: pointer; }
.device-list { border: 1px solid #ddd; border-radius: 8px; padding: 10px; margin-bottom: 30px; }
.device-item { display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid #eee; flex-wrap: wrap; }
.diag-btn { margin-left: auto; background: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; }
.monitor-btn { background: #9c27b0; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; }
.history-btn { background: #6c757d; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; }
.edit-btn { background: #17a2b8; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; }
.delete-btn { background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; }
.status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.status-dot.online { background: green; }
.status-dot.offline { background: red; }
.no-device { text-align: center; padding: 20px; color: #999; }

.chat-container { border: 1px solid #ccc; border-radius: 12px; padding: 15px; }
.chat-box { height: 300px; overflow-y: auto; margin-bottom: 15px; background: #fafafa; padding: 10px; }
.message-row { margin-bottom: 10px; }
.user .bubble { background: #007bff; color: white; float: right; clear: both; }
.assistant .bubble { background: #eee; float: left; clear: both; }
.bubble { padding: 8px 15px; border-radius: 10px; max-width: 80%; word-wrap: break-word; }
.input-area { display: flex; gap: 10px; }
input, select { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 8px; width: 100%; box-sizing: border-box; }
button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 8px; cursor: pointer; }

.bubble :deep(h1), .bubble :deep(h2), .bubble :deep(h3) { margin: 10px 0 5px 0; }
.bubble :deep(p) { margin: 5px 0; }
.bubble :deep(pre) { background: #2d2d2d; color: #f8f8f2; padding: 10px; border-radius: 6px; overflow-x: auto; }
.bubble :deep(code) { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
.bubble :deep(table) { border-collapse: collapse; margin: 10px 0; }
.bubble :deep(table td), .bubble :deep(table th) { border: 1px solid #ccc; padding: 5px 10px; }
.bubble :deep(ul), .bubble :deep(ol) { padding-left: 20px; }

.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal { background: white; padding: 20px; border-radius: 10px; width: 500px; max-height: 80vh; overflow-y: auto; }
.modal h3 { margin-top: 0; }
.modal-dashboard { background: #0f172a; padding: 20px; border-radius: 10px; width: 90vw; max-width: 1100px; max-height: 90vh; overflow-y: auto; }
.history-item { border-bottom: 1px solid #eee; padding: 12px 0; }
.history-time { color: #999; font-size: 12px; margin-bottom: 6px; }
.history-content { font-size: 14px; color: #333; }
.empty-history { text-align: center; color: #999; padding: 20px; }
.close-btn { margin-top: 15px; background: #6c757d; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; }

.form-group { margin-bottom: 12px; }
.form-group label { display: block; margin-bottom: 4px; font-size: 14px; color: #555; }
.form-actions { display: flex; gap: 10px; margin-top: 15px; justify-content: flex-end; }
.cancel-btn { background: #ccc; color: #333; }
.submit-btn { background: #28a745; }
</style>