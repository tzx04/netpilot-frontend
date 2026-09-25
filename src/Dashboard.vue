<template>
  <div class="dashboard-page">
    <div class="dashboard-header">
      <h2>📊 监控大屏 - {{ device.name }}</h2>
      <button @click="$emit('close')" class="close-btn">✕ 关闭</button>
    </div>

    <!-- 当前指标卡片 -->
    <div class="metric-cards">
      <div class="metric-card">
        <div class="metric-label">CPU 使用率</div>
        <div class="metric-value">{{ latest.cpuUsage ?? '--' }}<span v-if="latest.cpuUsage">%</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">内存使用率</div>
        <div class="metric-value">{{ latest.memoryUsage ?? '--' }}<span v-if="latest.memoryUsage">%</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">入站带宽</div>
        <div class="metric-value">{{ latest.bandwidthIn ?? '--' }}<span v-if="latest.bandwidthIn">bps</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">出站带宽</div>
        <div class="metric-value">{{ latest.bandwidthOut ?? '--' }}<span v-if="latest.bandwidthOut">bps</span></div>
      </div>
    </div>

    <!-- CPU / 内存趋势图 -->
    <div class="chart-container">
      <h3>📈 CPU / 内存使用率趋势（最近 24 小时）</h3>
      <div ref="cpuChartRef" class="chart"></div>
    </div>

    <!-- 带宽趋势图 -->
    <div class="chart-container">
      <h3>🌐 带宽趋势（最近 24 小时）</h3>
      <div ref="bandwidthChartRef" class="chart"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import axios from 'axios';
import * as echarts from 'echarts';

const props = defineProps({
  device: { type: Object, required: true }
});
const emit = defineEmits(['close']);

const latest = ref({});
const cpuChartRef = ref(null);
const bandwidthChartRef = ref(null);
let cpuChart = null;
let bandwidthChart = null;

const formatTime = (t) => {
  if (!t) return '';
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const loadData = async () => {
  try {
    // 1. 最新一条
    const latestRes = await axios.get(`http://localhost:8080/api/monitor/latest/${props.device.id}`);
    latest.value = latestRes.data || {};

    // 2. 历史数据
    const historyRes = await axios.get(`http://localhost:8080/api/monitor/history/${props.device.id}?hours=24`);
    const history = historyRes.data || [];

    const times = history.map(h => formatTime(h.collectTime));
    const cpuData = history.map(h => h.cpuUsage);
    const memData = history.map(h => h.memoryUsage);
    const bwIn = history.map(h => h.bandwidthIn);
    const bwOut = history.map(h => h.bandwidthOut);

    // 3. 渲染 CPU/内存折线图
    if (cpuChartRef.value) {
      cpuChart = echarts.init(cpuChartRef.value);
      cpuChart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['CPU', '内存'] },
        grid: { left: 50, right: 30, top: 40, bottom: 40 },
        xAxis: { type: 'category', data: times },
        yAxis: { type: 'value', name: '%', max: 100 },
        series: [
          { name: 'CPU', type: 'line', smooth: true, data: cpuData, itemStyle: { color: '#667eea' } },
          { name: '内存', type: 'line', smooth: true, data: memData, itemStyle: { color: '#f093fb' } }
        ]
      });
    }

    // 4. 渲染带宽折线图
    if (bandwidthChartRef.value) {
      bandwidthChart = echarts.init(bandwidthChartRef.value);
      bandwidthChart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['入站', '出站'] },
        grid: { left: 60, right: 30, top: 40, bottom: 40 },
        xAxis: { type: 'category', data: times },
        yAxis: { type: 'value', name: 'bps' },
        series: [
          { name: '入站', type: 'line', smooth: true, data: bwIn, itemStyle: { color: '#4facfe' } },
          { name: '出站', type: 'line', smooth: true, data: bwOut, itemStyle: { color: '#fa709a' } }
        ]
      });
    }
  } catch (e) {
    console.error('加载监控数据失败', e);
  }
};

onMounted(() => {
  nextTick(() => {
    loadData();
  });
});

onBeforeUnmount(() => {
  if (cpuChart) cpuChart.dispose();
  if (bandwidthChart) bandwidthChart.dispose();
});
</script>

<style scoped>
.dashboard-page {
  background: #0f172a;
  color: #e2e8f0;
  padding: 20px;
  border-radius: 12px;
}
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.dashboard-header h2 { margin: 0; color: #67e8f9; }
.close-btn { background: #dc3545; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; }

.metric-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
.metric-card {
  background: linear-gradient(135deg, #1e293b, #334155);
  padding: 20px;
  border-radius: 10px;
  text-align: center;
}
.metric-label { color: #94a3b8; font-size: 13px; margin-bottom: 8px; }
.metric-value { font-size: 26px; font-weight: bold; color: #67e8f9; }

.chart-container { margin-bottom: 25px; }
.chart-container h3 { margin: 0 0 10px 0; color: #cbd5e1; font-size: 15px; }
.chart { height: 280px; background: #1e293b; border-radius: 10px; padding: 10px; }
</style>