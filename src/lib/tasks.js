import { config, db, state, toast } from "../store.js";
import { putImage } from "./imageDb.js";
import {
  callEdits,
  callGenerations,
  extractResponseImages,
  formatUpstreamError,
  pickEndpoint,
  rawErrorFromException,
  UpstreamError,
} from "./upstream.js";
import { sleep } from "./util.js";

const MAX_TASK_HISTORY = 100;

// AbortController 属于宿主对象，不放响应式代理里，避免被 Proxy 包装
const controllers = new Map();

const CHOICE_KEYS = ["quality", "style", "background", "moderation", "output_format"];
const CHOICE_SETS = {
  quality: ["auto", "standard", "hd", "low", "medium", "high"],
  style: ["vivid", "natural"],
  background: ["auto", "opaque", "transparent"],
  moderation: ["auto", "low"],
  output_format: ["png", "jpeg", "webp"],
};

function normalizeCompression(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.max(0, Math.min(100, Math.round(parsed))));
}

// 对应后端 collect_image_options：空值回退到设置页默认值，n 固定为 1
export function buildImageOptions(values) {
  const source = values || {};
  const defaults = {
    quality: config.default_quality,
    style: config.default_style,
    background: config.default_background,
    moderation: config.default_moderation,
    output_format: config.default_output_format,
    output_compression: config.default_output_compression,
  };
  const options = { n: 1 };
  CHOICE_KEYS.forEach((key) => {
    let value = String(source[key] ?? "").trim();
    if (!value) value = defaults[key] || "";
    if (!value) return;
    options[key] = CHOICE_SETS[key].includes(value) ? value : value;
  });
  const compression = normalizeCompression(source.output_compression ?? defaults.output_compression);
  if (compression !== "" && ["jpeg", "webp"].includes(options.output_format)) {
    options.output_compression = Number(compression);
  }
  return options;
}

export function buildSizeValue({ size, width, height }) {
  if (size === "custom") {
    const w = Math.max(1, Number(width) || 1024);
    const h = Math.max(1, Number(height) || 1024);
    return `${w}x${h}`;
  }
  return size || "1024x1024";
}

function newId() {
  if (crypto?.randomUUID) return crypto.randomUUID().replaceAll("-", "");
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`.padEnd(32, "0").slice(0, 32);
}

// 提交一个生成任务；任务在前端并行执行，重启页面后任务历史清空（与原后端行为一致）
export function submitTask({
  mode,
  prompt,
  size,
  options,
  files = [],
  mask = null,
  endpointId = "",
  retries = 0,
}) {
  const endpoint = pickEndpoint(config, endpointId);
  const retryCount = Math.max(0, Math.min(9, Number(retries) || 0));
  const task = {
    id: newId(),
    mode,
    status: "queued",
    prompt,
    size,
    model: endpoint.model,
    endpoint_id: endpoint.id,
    endpoint_alias: endpoint.alias,
    attempt: 0,
    max_attempts: Math.max(1, Math.min(10, retryCount + 1)),
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
    completed_at: null,
    expected_seconds: config.expected_task_seconds || 90,
    images: [],
    error: "",
    raw_error: null,
  };
  state.tasks.unshift(task);
  pruneTasks();
  runTask(task, { options, files, mask, endpoint, controller: new AbortController() });
  return task;
}

function pruneTasks() {
  if (state.tasks.length <= MAX_TASK_HISTORY) return;
  const removable = state.tasks
    .filter((task) => ["succeeded", "failed"].includes(task.status))
    .sort((a, b) => a.updated_at - b.updated_at);
  const overflow = state.tasks.length - MAX_TASK_HISTORY;
  const ids = new Set(removable.slice(0, Math.max(0, overflow)).map((task) => task.id));
  if (ids.size) state.tasks = state.tasks.filter((task) => !ids.has(task.id));
}

function updateTask(task, changes) {
  Object.assign(task, changes, { updated_at: Math.floor(Date.now() / 1000) });
  if (["succeeded", "failed", "cancelled"].includes(task.status)) {
    controllers.delete(task.id);
  }
}

export function cancelTask(task) {
  if (!["queued", "running"].includes(task.status)) return;
  updateTask(task, {
    status: "cancelled",
    error: "任务已手动中断",
    completed_at: Math.floor(Date.now() / 1000),
  });
  controllers.get(task.id)?.abort();
}

export function clearTaskHistory() {
  const removable = state.tasks.filter((task) =>
    ["succeeded", "failed", "cancelled"].includes(task.status),
  );
  const ids = new Set(removable.map((task) => task.id));
  state.tasks = state.tasks.filter((task) => !ids.has(task.id));
  return removable.length;
}

async function runTask(task, { options, files, mask, endpoint, controller }) {
  controllers.set(task.id, controller);
  for (let attempt = 1; attempt <= task.max_attempts; attempt += 1) {
    if (task.status === "cancelled") return;
    updateTask(task, { status: "running", attempt, error: "", raw_error: null });
    try {
      let data;
      if (task.mode === "text") {
        data = await callGenerations(
          endpoint,
          { model: endpoint.model, prompt: task.prompt, size: task.size, ...options },
          controller.signal,
        );
      } else {
        const fields = { model: endpoint.model, prompt: task.prompt, size: task.size };
        Object.entries(options).forEach(([key, value]) => {
          fields[key] = value;
        });
        data = await callEdits(endpoint, fields, files, mask, controller.signal);
      }
      if (task.status === "cancelled") return;
      const saved = await saveGeneratedImages({
        response: data,
        prompt: task.prompt,
        size: task.size,
        mode: task.mode,
        model: endpoint.model,
        sourceFile: task.mode === "image" ? files[0] : null,
      });
      if (!saved.length) {
        throw new UpstreamError("接口没有返回可保存的图片，请检查上游返回格式", { raw: JSON.stringify(data) });
      }
      updateTask(task, {
        status: "succeeded",
        images: saved,
        model: endpoint.model,
        endpoint_alias: endpoint.alias,
        completed_at: Math.floor(Date.now() / 1000),
      });
      state.resultImages = saved;
      state.resultIndex = 0;
      return;
    } catch (exc) {
      if (task.status === "cancelled" || exc?.name === "AbortError") {
        if (task.status !== "cancelled") {
          updateTask(task, {
            status: "cancelled",
            error: "任务已手动中断",
            completed_at: Math.floor(Date.now() / 1000),
          });
        }
        return;
      }
      const rawError = rawErrorFromException(exc);
      updateTask(task, {
        error: exc instanceof UpstreamError ? formatUpstreamError(exc) : String(exc?.message || exc),
        raw_error: rawError,
      });
    }
    if (attempt < task.max_attempts) {
      await sleep(Math.min(2 * attempt, 8) * 1000);
    }
  }
  if (task.status !== "cancelled") {
    updateTask(task, { status: "failed", completed_at: Math.floor(Date.now() / 1000) });
  }
}

export async function saveGeneratedImages({ response, prompt, size, mode, model, sourceFile }) {
  const extracted = await extractResponseImages(response);
  const saved = [];
  let sourceImageId = "";
  if (sourceFile) {
    sourceImageId = newId();
    try {
      await putImage(sourceImageId, sourceFile);
    } catch (error) {
      console.warn("保存参考原图失败", error);
      sourceImageId = "";
    }
  }
  for (const item of extracted) {
    const imageId = newId();
    try {
      if (item.blob) {
        await putImage(imageId, item.blob);
      } else if (!item.remoteUrl) {
        continue;
      }
    } catch (error) {
      console.warn("保存图片失败", error);
      toast("浏览器存储空间不足，新图片未能保存");
      continue;
    }
    saved.push({
      id: newId(),
      created_at: Math.floor(Date.now() / 1000),
      image_id: item.blob ? imageId : "",
      remote_url: item.blob ? "" : item.remoteUrl,
      source_image_id: sourceImageId,
      source_filename: sourceFile ? sourceFile.name : "",
      title: item.revisedPrompt || prompt.slice(0, 40),
      prompt,
      revised_prompt: item.revisedPrompt || "",
      size,
      mode,
      model,
      tags: [],
      archived: false,
    });
  }
  if (saved.length) {
    db.images.unshift(...saved);
    pruneGallery();
  }
  return saved;
}

function pruneGallery() {
  // 画廊数据不做上限，仅防止异常增长；如需清理请手动删除
}
