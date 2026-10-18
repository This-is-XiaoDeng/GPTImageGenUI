import { reactive } from "vue";

// 图片本体存储在 IndexedDB（浏览器本地，容量远大于 localStorage 的 ~5MB），
// localStorage 只保存图片元数据；通过 id 关联。
const DB_NAME = "imagegenui";
const STORE_NAME = "images";
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function runStore(mode, action) {
  return openDb().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const result = action(store);
        tx.oncomplete = () => resolve(result.result ?? result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export function putImage(id, blob) {
  if (!id || !blob) return Promise.resolve();
  return runStore("readwrite", (store) => store.put(blob, id));
}

export function getImage(id) {
  if (!id) return Promise.resolve(null);
  return runStore("readonly", (store) => store.get(id));
}

export function deleteImage(id) {
  if (!id) return Promise.resolve();
  if (urlStore[id]) {
    URL.revokeObjectURL(urlStore[id]);
    delete urlStore[id];
  }
  return runStore("readwrite", (store) => store.delete(id));
}

// 响应式的 objectURL 缓存：组件模板直接绑定 urlStore[id]
export const urlStore = reactive({});

export async function ensureImageUrl(id) {
  if (!id) return "";
  if (urlStore[id]) return urlStore[id];
  try {
    const blob = await getImage(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      urlStore[id] = url;
      return url;
    }
  } catch (error) {
    console.warn("读取图片失败", id, error);
  }
  urlStore[id] = "";
  return "";
}

export async function getBlobById(id) {
  try {
    return await getImage(id);
  } catch (error) {
    console.warn("读取图片失败", id, error);
    return null;
  }
}

export async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "image.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
