<script setup>
import { ref } from "vue";
import { config, state, toast, confirmAction, normalizeEndpointId, COLOR_THEMES, SIZE_OPTIONS, CHOICES } from "../store.js";

const hint = ref("");
const secretsVisible = ref({});
const backgroundPopoverOpen = ref(false);
const opacityPercent = ref(Math.round(config.web_background_opacity * 100));

function addEndpoint() {
  const index = config.endpoints.length + 1;
  config.endpoints.push({
    id: normalizeEndpointId(`endpoint-${Date.now().toString(36)}-${index}`, `endpoint-${index}`),
    alias: `后端 ${index}`,
    base_url: "https://api.openai.com/v1",
    model: "gpt-image-1",
    api_key: "",
  });
}

async function removeEndpoint(id) {
  if (config.endpoints.length <= 1) {
    toast("至少保留一个后端接口");
    return;
  }
  const endpoint = config.endpoints.find((item) => item.id === id);
  const confirmed = await confirmAction("删除后端", `确认删除「${endpoint?.alias || "这个后端"}」？`);
  if (!confirmed) return;
  config.endpoints = config.endpoints.filter((item) => item.id !== id);
  if (!config.endpoints.some((item) => item.id === config.active_endpoint_id)) {
    config.active_endpoint_id = config.endpoints[0]?.id || "";
  }
}

function toggleSecret(id) {
  secretsVisible.value[id] = !secretsVisible.value[id];
}

function onOpacityInput() {
  config.web_background_opacity = Math.max(0, Math.min(100, Number(opacityPercent.value) || 0)) / 100;
}

function clearBackground() {
  config.web_background_url = "";
  opacityPercent.value = Math.round(config.web_background_opacity * 100);
}

function save() {
  applyOpacityFromInput();
  hint.value = "设置已保存（已自动写入浏览器本地存储）。";
  toast("设置已保存");
}

function applyOpacityFromInput() {
  config.web_background_opacity = Math.max(0, Math.min(100, Number(opacityPercent.value) || 0)) / 100;
}
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Runtime</p>
        <h1>设置</h1>
      </div>
    </div>
    <div class="settings-stack">
      <section class="panel settings-panel">
        <div class="panel-head">
          <h2>后端接口</h2>
          <button class="ghost" type="button" @click="addEndpoint">添加后端</button>
        </div>
        <label class="field">
          <span>当前活跃后端</span>
          <select v-model="config.active_endpoint_id">
            <option v-for="endpoint in config.endpoints" :key="endpoint.id" :value="endpoint.id">
              {{ endpoint.alias || endpoint.model || endpoint.id }}
            </option>
          </select>
        </label>
        <div class="endpoint-list">
          <section v-for="(endpoint, index) in config.endpoints" :key="endpoint.id" class="endpoint-card" :data-endpoint-id="endpoint.id">
            <div class="endpoint-head">
              <button
                class="endpoint-toggle"
                type="button"
                :aria-expanded="!endpoint.collapsed"
                @click="endpoint.collapsed = !endpoint.collapsed"
              >
                <i :class="endpoint.collapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-down'"></i>
                <span>{{ endpoint.alias || `后端 ${index + 1}` }}</span>
                <small>{{ endpoint.model }}</small>
              </button>
            </div>
            <div v-show="!endpoint.collapsed" class="endpoint-body">
              <label class="field">
                <span>别名</span>
                <input v-model="endpoint.alias" placeholder="例如 主线路 / NewAPI / 备用节点" />
              </label>
              <label class="field">
                <span>接口基地址（含 /v1）</span>
                <input v-model="endpoint.base_url" placeholder="https://your-api.example.com/v1" />
              </label>
              <label class="field">
                <span>模型名</span>
                <input v-model="endpoint.model" placeholder="gpt-image-1 / gpt-image-2" />
              </label>
              <label class="field">
                <span>API Key</span>
                <div class="secret-row">
                  <input
                    v-model="endpoint.api_key"
                    :type="secretsVisible[endpoint.id] ? 'text' : 'password'"
                    placeholder="输入 API Key"
                  />
                  <button class="icon-btn" type="button" title="显示或隐藏 API Key" @click="toggleSecret(endpoint.id)">
                    <i :class="secretsVisible[endpoint.id] ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
                  </button>
                </div>
              </label>
              <div class="endpoint-actions">
                <button class="ghost danger compact-danger" type="button" @click="removeEndpoint(endpoint.id)">删除后端</button>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section class="panel settings-panel">
        <div class="panel-head">
          <h2>其它配置</h2>
        </div>
        <label class="field">
          <span>预期生成时间（秒，用于任务进度条）</span>
          <input v-model.number="config.expected_task_seconds" type="number" min="5" max="3600" />
        </label>
        <label class="field">
          <span>网页图标 URL</span>
          <input v-model="config.web_icon_url" type="url" placeholder="https://example.com/icon.png" />
        </label>
        <label class="field">
          <span>页面配色风格</span>
          <select v-model="config.color_theme">
            <option v-for="theme in COLOR_THEMES" :key="theme.value" :value="theme.value">{{ theme.label }}</option>
          </select>
        </label>
        <label class="field">
          <span>背景图片 URL</span>
          <div class="inline-control">
            <input v-model="config.web_background_url" type="url" placeholder="https://example.com/background.jpg" />
            <button class="icon-btn" type="button" title="背景显示选项" @click="backgroundPopoverOpen = !backgroundPopoverOpen">
              <i class="fa-solid fa-sliders"></i>
            </button>
            <div v-show="backgroundPopoverOpen" class="settings-popover">
              <label class="field mini-field">
                <span>图片透明度</span>
                <input v-model.number="opacityPercent" type="range" min="0" max="100" @change="onOpacityInput" />
              </label>
              <div class="opacity-readout">
                <span>{{ opacityPercent }}%</span>
                <button class="ghost compact-danger" type="button" @click="clearBackground">清除背景图</button>
              </div>
            </div>
          </div>
        </label>
        <label class="field">
          <span>失败自动重试次数</span>
          <input v-model.number="config.default_retries" type="number" min="0" max="9" />
        </label>
        <label class="field">
          <span>文生图默认分辨率</span>
          <select v-model="config.default_text_size">
            <option v-for="value in SIZE_OPTIONS" :key="value" :value="value">{{ value }}</option>
          </select>
        </label>
        <div class="grid compact">
          <label class="field">
            <span>默认质量</span>
            <select v-model="config.default_quality">
              <option value="">不发送</option>
              <option v-for="value in CHOICES.quality" :key="value" :value="value">{{ value }}</option>
            </select>
          </label>
          <label class="field">
            <span>默认安全过滤</span>
            <select v-model="config.default_moderation">
              <option value="">不发送</option>
              <option v-for="value in CHOICES.moderation" :key="value" :value="value">{{ value }}</option>
            </select>
          </label>
          <label class="field">
            <span>默认背景</span>
            <select v-model="config.default_background">
              <option value="">不发送</option>
              <option v-for="value in CHOICES.background" :key="value" :value="value">{{ value }}</option>
            </select>
          </label>
          <label class="field">
            <span>默认输出格式</span>
            <select v-model="config.default_output_format">
              <option value="">不发送</option>
              <option v-for="value in CHOICES.output_format" :key="value" :value="value">{{ value }}</option>
            </select>
          </label>
          <label class="field">
            <span>默认输出压缩率</span>
            <input v-model="config.default_output_compression" type="number" min="0" max="100" placeholder="0-100，仅 jpeg/webp" />
          </label>
          <label class="field">
            <span>默认风格</span>
            <select v-model="config.default_style">
              <option value="">不发送</option>
              <option v-for="value in CHOICES.style" :key="value" :value="value">{{ value }}</option>
            </select>
          </label>
        </div>
        <p class="hint">
          纯前端版本的所有数据（后端配置、API Key、画廊、提示词）都保存在浏览器 localStorage / IndexedDB 中，仅本设备可见，请勿在公共电脑上保存 API Key。
        </p>
        <button class="primary" type="button" @click="save">保存设置</button>
        <p class="hint">{{ hint }}</p>
      </section>
    </div>
  </section>
</template>
