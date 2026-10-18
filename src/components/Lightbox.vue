<script setup>
import { computed } from "vue";
import { state, switchPage, toast } from "../store.js";
import { getBlobById, downloadBlob } from "../lib/imageDb.js";
import { safeDownloadName, mimeToExt } from "../lib/util.js";

const lightbox = computed(() => state.lightbox);

async function download() {
  const item = lightbox.value;
  if (!item) return;
  if (item.blobId) {
    const blob = await getBlobById(item.blobId);
    if (blob) {
      await downloadBlob(blob, item.downloadName || "image.png");
      return;
    }
  }
  if (item.url) {
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.downloadName || "image.png";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

function openOriginal() {
  if (lightbox.value?.url) window.open(lightbox.value.url, "_blank", "noopener");
}

async function editAsSource() {
  const item = lightbox.value;
  if (!item) return;
  let blob = item.blobId ? await getBlobById(item.blobId) : null;
  if (!blob && item.url) {
    try {
      const response = await fetch(item.url);
      if (response.ok) blob = await response.blob();
    } catch {
      blob = null;
    }
  }
  if (!blob) {
    toast("读取图片失败");
    return;
  }
  const name = `${safeDownloadName(item.title || "image")}${mimeToExt(blob.type)}`;
  state.workbenchEditFile = new File([blob], name, { type: blob.type || "image/png" });
  state.lightbox = null;
  switchPage("workbench");
  toast("已填充到图生图原图位置");
}
</script>

<template>
  <div v-if="lightbox" class="modal" @click.self="state.lightbox = null">
    <div class="lightbox-card">
      <button class="lightbox-close" type="button" @click="state.lightbox = null">关闭</button>
      <img :src="lightbox.url" :alt="lightbox.title" @click="openOriginal" />
      <h2>{{ lightbox.title }}</h2>
      <button
        v-if="lightbox.showEdit"
        class="icon-btn lightbox-edit"
        type="button"
        title="作为图生图原图编辑"
        @click="editAsSource"
      >
        <i class="fa-solid fa-pen-to-square"></i>
      </button>
      <button class="icon-btn lightbox-download" type="button" title="下载当前图片" @click="download">
        <i class="fa-solid fa-download"></i>
      </button>
    </div>
  </div>
</template>
