import { mimeToExt } from "./util.js";

// 浏览器直连 OpenAI 兼容接口（POST {base_url}/images/generations 与 /images/edits）。
// 注意：能否跨域取决于上游服务的 CORS 配置；api.openai.com 支持浏览器直连。

export function pickEndpoint(config, endpointId) {
  const list = config.endpoints || [];
  return list.find((item) => item.id === endpointId) || list[0];
}

function buildHeaders(endpoint) {
  const headers = { Accept: "*/*" };
  if (endpoint.api_key) headers.Authorization = `Bearer ${endpoint.api_key}`;
  return headers;
}

export class UpstreamError extends Error {
  constructor(message, { status = null, detail = null, raw = "" } = {}) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.detail = detail;
    this.raw = raw;
  }
}

export function formatUpstreamError(exc) {
  const prefix = exc.status ? `Upstream HTTP ${exc.status}` : "Upstream request failed";
  const detail = exc.detail;
  if (detail && typeof detail === "object") {
    const error = detail.error ?? detail;
    if (error && typeof error === "object") {
      const message = error.message || error.type || exc.message;
      const code = error.code ? ` (code: ${error.code})` : "";
      return `${prefix}: ${message}${code}`;
    }
    return `${prefix}: ${JSON.stringify(detail)}`;
  }
  if (detail) return `${prefix}: ${detail}`;
  return exc.message || prefix;
}

function rawErrorFrom(exc) {
  return {
    message: String(exc.message || exc),
    status: exc.status ?? null,
    detail: exc.detail ?? null,
    raw: exc.raw ?? "",
  };
}

async function parseResponse(response) {
  const text = await response.text();
  if (response.status >= 400) {
    let detail = text;
    try {
      detail = text ? JSON.parse(text) : text;
    } catch {
      detail = text;
    }
    throw new UpstreamError(`Upstream HTTP ${response.status}`, { status: response.status, detail, raw: text });
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new UpstreamError("Upstream response is not JSON", { raw: text });
  }
}

export async function callGenerations(endpoint, payload, signal) {
  const response = await fetch(`${endpoint.base_url.replace(/\/+$/, "")}/images/generations`, {
    method: "POST",
    headers: { ...buildHeaders(endpoint), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  return parseResponse(response);
}

export async function callEdits(endpoint, fields, files, mask, signal) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) form.append(key, String(value));
  });
  files.forEach((file, index) => {
    form.append(files.length > 1 ? "image[]" : "image", file, file.name || `reference-${index + 1}.png`);
  });
  if (mask) form.append("mask", mask, mask.name || "mask.png");
  const response = await fetch(`${endpoint.base_url.replace(/\/+$/, "")}/images/edits`, {
    method: "POST",
    headers: buildHeaders(endpoint),
    body: form,
    signal,
  });
  return parseResponse(response);
}

// 把上游返回的 data 数组转成 { blob, remoteUrl, revisedPrompt }
export async function extractResponseImages(data, signal) {
  const items = Array.isArray(data?.data) ? data.data : [];
  const result = [];
  for (const item of items) {
    if (item?.b64_json) {
      result.push({
        blob: base64ToBlob(item.b64_json),
        remoteUrl: "",
        revisedPrompt: item.revised_prompt || "",
      });
    } else if (item?.url) {
      let blob = null;
      try {
        const response = await fetch(item.url, { signal });
        if (response.ok) blob = await response.blob();
      } catch {
        blob = null;
      }
      result.push({
        blob,
        remoteUrl: blob ? "" : String(item.url),
        revisedPrompt: item.revised_prompt || "",
      });
    }
  }
  return result;
}

export function rawErrorFromException(exc) {
  if (exc instanceof UpstreamError) return rawErrorFrom(exc);
  return { message: String(exc?.message || exc), status: null, detail: null, raw: "" };
}

export { mimeToExt };

function base64ToBlob(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const type = detectImageType(bytes);
  return new Blob([bytes], { type });
}

function detectImageType(bytes) {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length > 12 && bytes[8] === 0x57 && bytes[9] === 0x45) return "image/webp";
  return "image/png";
}
