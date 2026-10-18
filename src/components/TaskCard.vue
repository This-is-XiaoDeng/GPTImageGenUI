<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { state, toast, confirmAction } from "../store.js";
import { ensureImageUrl } from "../lib/imageDb.js";
import { cancelTask } from "../lib/tasks.js";
import { formatDuration } from "../lib/util.js";

const props = defineProps({
  task: { type: Object, required: true },
});

const now = ref(Math.floor(Date.now() / 1000));
const timer = window.setInterval(() => {
  now.value = Math.floor(Date.now() / 1000);
}, 1000);
onBeforeUnmount(() => window.clearInterval(timer));

const STATUS_TEXT = {
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已中断",
};

const statusText = computed(() => STATUS_TEXT[props.task.status] || props.task.status);
const canCancel = computed(() => ["queued", "running"].includes(props.task.status));
const elapsed = computed(() => {
  const end = props.task.completed_at || now.value;
  return Math.max(0, end - props.task.created_at);
});
const expected = computed(() => Math.max(5, Number(props.task.expected_seconds || 90)));
const progress = computed(() => {
  if (props.task.status === "succeeded") return 100;
  return Math.min(100, Math.round((elapsed.value / expected.value) * 100));
});
const taskImageUrls = ref({});

async function loadTaskImages() {
  for (const image of props.task.images || []) {
    if (!image.image_id) continue;
    taskImageUrls.value[image.id] = await ensureImageUrl(image.image_id);
  }
}
onMounted(loadTaskImages);
watch(() => props.task.images, loadTaskImages, { deep: true });

async function copyPrompt() {
  await navigator.clipboard.writeText(props.task.prompt || "");
  toast("已复制");
}

function fill() {
  state.workbenchFill = { prompt: props.task.prompt, size: props.task.size || "1024x1024" };
}

async function cancel() {
  const confirmed = await confirmAction("中断任务", `确认中断任务 #${props.task.id.slice(0, 8)}？`);
  if (!confirmed) return;
  cancelTask(props.task);
  toast("任务已中断");
}
</script>

<template>
  <article class="task-card" :class="task.status">
    <div class="task-main">
      <div>
        <strong>{{ statusText }}</strong>
        <span class="muted">#{{ task.id.slice(0, 8) }} · {{ task.mode === "image" ? "图生图" : "文生图" }} · {{ task.size }} · {{ task.endpoint_alias || "默认后端" }}</span>
      </div>
      <span class="task-badge">{{ task.attempt }}/{{ task.max_attempts }}</span>
    </div>
    <div class="task-progress-row">
      <span>已用 {{ formatDuration(elapsed) }}</span>
      <span>预期 {{ formatDuration(expected) }}</span>
    </div>
    <div class="task-progress" aria-label="任务进度">
      <span :style="{ width: `${progress}%` }"></span>
    </div>
    <p class="prompt-text">{{ task.prompt }}</p>
    <p v-if="task.error" class="task-error">{{ task.error }}</p>
    <details v-if="task.raw_error" class="raw-error">
      <summary>查看原始报错</summary>
      <pre>{{ JSON.stringify(task.raw_error, null, 2) }}</pre>
    </details>
    <div v-if="task.images && task.images.length" class="task-images">
      <img
        v-for="image in task.images"
        :key="image.id"
        :src="taskImageUrls[image.id] || image.remote_url"
        :alt="image.prompt"
        loading="lazy"
      />
    </div>
    <div v-if="canCancel" class="card-actions compact-actions">
      <button class="ghost danger" type="button" @click="cancel">
        <i class="fa-solid fa-stop"></i> 中断任务
      </button>
    </div>
    <div v-if="task.images && task.images.length" class="card-actions">
      <button type="button" @click="fill">填充</button>
      <button type="button" @click="copyPrompt">复制提示词</button>
    </div>
  </article>
</template>
