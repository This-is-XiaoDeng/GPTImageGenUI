import { reactive, watch } from "vue";

const CONFIG_KEY = "imagegen.config";
const DB_KEY = "imagegen.db";
const SIDEBAR_KEY = "sidebarCollapsed";

const SIZE_OPTIONS = [
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "1792x1024",
  "1024x1792",
  "2048x2048",
  "2048x1152",
  "1152x2048",
  "3840x2160",
  "2160x3840",
  "512x512",
  "256x256",
  "auto",
];

const CHOICES = {
  quality: ["auto", "standard", "hd", "low", "medium", "high"],
  style: ["vivid", "natural"],
  background: ["auto", "opaque", "transparent"],
  moderation: ["auto", "low"],
  output_format: ["png", "jpeg", "webp"],
};

export const COLOR_THEMES = [
  { value: "terracotta", label: "陶土暖色" },
  { value: "forest", label: "森林绿" },
  { value: "ocean", label: "海岸蓝" },
  { value: "slate", label: "石板灰" },
  { value: "rose", label: "玫瑰红" },
];

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function choice(value, allowed, fallback = "") {
  const raw = String(value ?? "").trim();
  return allowed.includes(raw) ? raw : fallback;
}

function defaultEndpoint() {
  return {
    id: "default",
    alias: "默认后端",
    base_url: "https://api.openai.com/v1",
    model: "gpt-image-1",
    api_key: "",
  };
}

function normalizeEndpointId(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return normalized || fallback;
}

function normalizeEndpoints(items) {
  const list = Array.isArray(items) ? items : [];
  const result = [];
  const seen = new Set();
  list.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    let id = normalizeEndpointId(item.id, `endpoint-${index + 1}`);
    if (seen.has(id)) id = normalizeEndpointId(`${id}-${index + 1}`, `endpoint-${index + 1}`);
    seen.add(id);
    result.push({
      id,
      alias: String(item.alias ?? "").trim() || `后端 ${index + 1}`,
      base_url: String(item.base_url ?? "").trim().replace(/\/+$/, "") || defaultEndpoint().base_url,
      model: String(item.model ?? "").trim() || defaultEndpoint().model,
      api_key: String(item.api_key ?? "").trim(),
    });
  });
  return result.length ? result : [defaultEndpoint()];
}

function normalizeConfig(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const endpoints = normalizeEndpoints(source.endpoints);
  const activeId = normalizeEndpointId(source.active_endpoint_id, endpoints[0].id);
  const compression = clampNumber(source.default_output_compression ?? "", 0, 0, 100);
  return {
    endpoints,
    active_endpoint_id: endpoints.some((item) => item.id === activeId) ? activeId : endpoints[0].id,
    expected_task_seconds: clampNumber(source.expected_task_seconds ?? 90, 90, 5, 3600),
    default_retries: clampNumber(source.default_retries ?? 0, 0, 0, 9),
    default_text_size: SIZE_OPTIONS.includes(source.default_text_size) ? source.default_text_size : "1024x1024",
    default_quality: choice(source.default_quality, CHOICES.quality),
    default_style: choice(source.default_style, CHOICES.style),
    default_background: choice(source.default_background, CHOICES.background),
    default_moderation: choice(source.default_moderation, CHOICES.moderation),
    default_output_format: choice(source.default_output_format, CHOICES.output_format),
    default_output_compression: compression ? String(compression) : "",
    web_icon_url: String(source.web_icon_url ?? "").trim(),
    web_background_url: String(source.web_background_url ?? "").trim(),
    web_background_opacity: clampNumber((Number(source.web_background_opacity ?? 0.22) || 0) * 100, 22, 0, 100) / 100,
    color_theme: COLOR_THEMES.some((theme) => theme.value === source.color_theme) ? source.color_theme : "terracotta",
  };
}

function normalizeTags(value) {
  const parts = Array.isArray(value) ? value.map(String) : String(value ?? "").split(/[,，\s]+/);
  return [...new Set(parts.map((part) => part.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalizeImageRecord(item) {
  if (!item || typeof item !== "object") return null;
  if (!item.id || (!item.image_id && !item.remote_url)) return null;
  return {
    id: String(item.id),
    created_at: Number(item.created_at) || Math.floor(Date.now() / 1000),
    image_id: String(item.image_id || ""),
    remote_url: String(item.remote_url || ""),
    source_image_id: String(item.source_image_id || ""),
    source_filename: String(item.source_filename || ""),
    title: String(item.title ?? ""),
    prompt: String(item.prompt ?? ""),
    revised_prompt: String(item.revised_prompt ?? ""),
    size: String(item.size ?? ""),
    mode: item.mode === "image" ? "image" : "text",
    model: String(item.model ?? ""),
    tags: normalizeTags(item.tags),
    archived: Boolean(item.archived),
  };
}

function normalizePromptRecord(item) {
  if (!item || typeof item !== "object") return null;
  if (!item.id || !String(item.prompt ?? "").trim()) return null;
  return {
    id: String(item.id),
    title: String(item.title ?? "").trim() || String(item.prompt ?? "").slice(0, 28),
    prompt: String(item.prompt ?? "").trim(),
    tags: normalizeTags(item.tags),
    reference_image_id: String(item.reference_image_id || ""),
    created_at: Number(item.created_at) || Math.floor(Date.now() / 1000),
  };
}

function normalizeDb(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const images = Array.isArray(source.images) ? source.images.map(normalizeImageRecord).filter(Boolean) : [];
  const prompts = Array.isArray(source.prompts) ? source.prompts.map(normalizePromptRecord).filter(Boolean) : [];
  return { images, prompts };
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`读取 ${key} 失败`, error);
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`写入 ${key} 失败`, error);
    if (typeof state.onStorageError === "function") state.onStorageError(error);
  }
}

// ---------- 全局响应式状态 ----------

export const config = reactive(normalizeConfig(loadJson(CONFIG_KEY, null)));
export const db = reactive(normalizeDb(loadJson(DB_KEY, null)));

export const state = reactive({
  page: "workbench",
  sidebarCollapsed: localStorage.getItem(SIDEBAR_KEY) === "1",
  mobileNavOpen: false,
  toastMessage: "",
  toastTimer: null,
  confirmRequest: null, // { title, message, resolve }
  lightbox: null, // { url, title, downloadName, imageUrl, showEdit, blobId }
  resultImages: [],
  resultIndex: 0,
  tasks: [],
  workbenchFill: null, // { prompt, size } 待填充到工作台
  workbenchEditFile: null, // File，作为图生图原图填充
  promptDialog: null, // null | { mode: 'add' } | { mode: 'edit', id }
  imageEditDialog: null, // null | 图片 id
  selectedGalleryTags: [],
  selectedPromptTags: [],
  gallerySearch: "",
  promptSearch: "",
  showArchivedImages: false,
  onStorageError: null,
});

watch(
  config,
  () => saveJson(CONFIG_KEY, JSON.parse(JSON.stringify(config))),
  { deep: true },
);
watch(
  db,
  () => saveJson(DB_KEY, JSON.parse(JSON.stringify(db))),
  { deep: true },
);

// ---------- 通用工具 ----------

export function toast(message) {
  state.toastMessage = message || "";
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    state.toastMessage = "";
  }, 2600);
}

export function confirmAction(title, message) {
  return new Promise((resolve) => {
    state.confirmRequest = { title, message, resolve };
  });
}

export function resolveConfirm(value) {
  if (state.confirmRequest) {
    state.confirmRequest.resolve(value);
    state.confirmRequest = null;
  }
}

export function switchPage(page) {
  state.page = page;
  state.mobileNavOpen = false;
}

export function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
}

export function activeEndpoint() {
  return config.endpoints.find((item) => item.id === config.active_endpoint_id) || config.endpoints[0];
}

export function findImage(id) {
  return [...db.images, ...state.resultImages].find((item) => item.id === id);
}

export function findPrompt(id) {
  return db.prompts.find((item) => item.id === id);
}

export { normalizeTags, normalizeEndpointId, SIZE_OPTIONS, CHOICES, clampNumber, choice };
