<script setup>
import { computed, onMounted, ref } from "vue";
import { state, toast } from "../store.js";
import { ensureImageUrl, getBlobById, downloadBlob } from "../lib/imageDb.js";
import { safeDownloadName } from "../lib/util.js";

const props = defineProps({
  item: { type: Object, required: true },
});
const emit = defineEmits(["edit"]);

const imageUrl = ref("");
const sourceUrl = ref("");

const title = computed(() => props.item.title || props.item.revised_prompt || "未命名图片");
const downloadName = computed(
  () => `${safeDownloadName(title.value)}-${props.item.id.slice(0, 8)}.png`,
);

onMounted(async () => {
  imageUrl.value = (await ensureImageUrl(props.item.image_id)) || props.item.remote_url || "";
  if (props.item.source_image_id) sourceUrl.value = (await ensureImageUrl(props.item.source_image_id)) || "";
});

async function copyPrompt() {
  await navigator.clipboard.writeText(props.item.prompt || "");
  toast("已复制");
}

function fill() {
  state.workbenchFill = { prompt: props.item.prompt, size: props.item.size || "1024x1024" };
  toast("已填充到工作台");
}

function openLightbox() {
  state.lightbox = {
    url: imageUrl.value || props.item.remote_url,
    title: title.value,
    downloadName: downloadName.value,
    blobId: props.item.image_id,
    showEdit: true,
  };
}

function openSourceLightbox() {
  if (!sourceUrl.value) return;
  state.lightbox = {
    url: sourceUrl.value,
    title: `${title.value} · 原图`,
    downloadName: props.item.source_filename || "source-image",
    blobId: props.item.source_image_id,
    showEdit: false,
  };
}

async function downloadImage() {
  const blob = props.item.image_id ? await getBlobById(props.item.image_id) : null;
  if (blob) {
    await downloadBlob(blob, downloadName.value);
    return;
  }
  if (props.item.remote_url) {
    const link = document.createElement("a");
    link.href = props.item.remote_url;
    link.download = downloadName.value;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
</script>

<template>
  <article class="image-card" :data-id="item.id">
    <button class="image-preview" type="button" aria-label="查看大图" @click="openLightbox">
      <img v-if="imageUrl" :src="imageUrl" :alt="title" loading="lazy" />
      <img v-else-if="item.remote_url" :src="item.remote_url" :alt="title" loading="lazy" />
    </button>
    <div class="card-body">
      <h3 class="image-title">{{ title }}</h3>
      <div class="meta-row">
        <span>{{ item.size }}</span>
        <span>{{ item.model }}</span>
        <span>{{ item.mode === "image" ? "图生图" : "文生图" }}</span>
        <span v-if="item.archived" class="tag archive-tag">已归档</span>
        <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>
      <div class="icon-actions">
        <span class="prompt-tooltip-wrap">
          <button class="icon-btn" type="button" title="复制提示词" @click="copyPrompt">
            <i class="fa-regular fa-copy"></i>
          </button>
          <span class="prompt-popup">{{ item.prompt }}</span>
        </span>
        <button class="icon-btn" type="button" title="填充到工作台" @click="fill">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </button>
        <button class="icon-btn" type="button" title="下载图片" @click="downloadImage">
          <i class="fa-solid fa-download"></i>
        </button>
        <button
          v-if="item.mode === 'image' && item.source_image_id"
          class="icon-btn"
          type="button"
          title="查看原图"
          @click="openSourceLightbox"
        >
          <i class="fa-regular fa-image"></i>
        </button>
        <button class="icon-btn" type="button" title="编辑标题和标签" @click="emit('edit', item.id)">
          <i class="fa-solid fa-gear"></i>
        </button>
      </div>
    </div>
  </article>
</template>
