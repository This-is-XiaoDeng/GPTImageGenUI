<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { state, toast, confirmAction, db } from "../store.js";
import { ensureImageUrl, deleteImage } from "../lib/imageDb.js";
import { safeDownloadName, mimeToExt } from "../lib/util.js";

const props = defineProps({
  item: { type: Object, required: true },
});
const emit = defineEmits(["edit"]);

const referenceUrl = ref("");

async function loadReference() {
  referenceUrl.value = (await ensureImageUrl(props.item.reference_image_id)) || "";
}
onMounted(loadReference);
watch(() => props.item.reference_image_id, loadReference);

const title = computed(() => props.item.title || props.item.prompt.slice(0, 28));

function fill() {
  state.workbenchFill = { prompt: props.item.prompt, size: "" };
  toast("已填充到工作台");
}

async function copyPrompt() {
  await navigator.clipboard.writeText(props.item.prompt || "");
  toast("已复制");
}

function openReference() {
  if (!referenceUrl.value) return;
  state.lightbox = {
    url: referenceUrl.value,
    title: `${title.value} · 参考图`,
    downloadName: `${safeDownloadName(title.value)}-reference${mimeToExt("image/png")}`,
    blobId: props.item.reference_image_id,
    showEdit: false,
  };
}

async function removeSelf() {
  const confirmed = await confirmAction("删除提示词", `确认删除「${title.value}」？此操作不可恢复。`);
  if (!confirmed) return;
  await deleteImage(props.item.reference_image_id);
  const index = db.prompts.findIndex((prompt) => prompt.id === props.item.id);
  if (index >= 0) db.prompts.splice(index, 1);
  toast("提示词已删除");
}
</script>

<template>
  <article class="prompt-card" :class="{ 'has-reference': referenceUrl }" :data-id="item.id">
    <button v-if="referenceUrl" class="prompt-reference-btn" type="button" title="查看参考图大图" @click="openReference">
      <img class="prompt-reference-thumb" :src="referenceUrl" :alt="`${title} 的参考图`" loading="lazy" />
    </button>
    <div class="prompt-card-content">
      <h3>{{ title }}</h3>
      <p class="prompt-text">{{ item.prompt }}</p>
    </div>
    <div class="meta-row">
      <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
    </div>
    <div class="icon-actions prompt-actions">
      <button class="icon-btn" type="button" title="填充到工作台" @click="fill">
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
      </button>
      <button class="icon-btn" type="button" title="复制提示词" @click="copyPrompt">
        <i class="fa-regular fa-copy"></i>
      </button>
      <button class="icon-btn" type="button" title="编辑提示词" @click="emit('edit', item.id)">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button class="icon-btn danger-icon" type="button" title="删除提示词" @click="removeSelf">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  </article>
</template>
