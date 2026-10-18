<script setup>
import { computed, ref, watch, nextTick } from "vue";
import { config, state, toast, switchPage, SIZE_OPTIONS, CHOICES } from "../store.js";
import { buildImageOptions, buildSizeValue, submitTask } from "../lib/tasks.js";
import { pickEndpoint } from "../lib/upstream.js";
import { ensureImageUrl } from "../lib/imageDb.js";
import { fixModalGeometry, trackModalGeometry } from "../lib/modalFix.js";
import TaskCard from "./TaskCard.vue";
import MaskPainter from "./MaskPainter.vue";

const maskModalRef = ref(null);
let releaseMaskTrack = null;

const prompt = ref("");
const mode = ref("text");
const size = ref(config.default_text_size || "1024x1024");
const width = ref(1024);
const height = ref(1024);
const quality = ref(config.default_quality || "");
const moderation = ref(config.default_moderation || "");
const background = ref(config.default_background || "");
const outputFormat = ref(config.default_output_format || "");
const outputCompression = ref(config.default_output_compression || "");
const style = ref(config.default_style || "");
const hint = ref("");

const textModeSize = ref(config.default_text_size || "1024x1024");

const editFiles = ref([]);
const editImageUrl = ref("");
const editImageName = ref("");
const paintedMaskBlob = ref(null);
const maskFile = ref(null);
const maskSourceKey = ref("");
const maskPainterOpen = ref(false);

watch(maskPainterOpen, async (open) => {
  if (open) {
    await nextTick();
    await fixModalGeometry(maskModalRef.value);
    releaseMaskTrack?.();
    releaseMaskTrack = trackModalGeometry(maskModalRef.value);
  } else {
    releaseMaskTrack?.();
    releaseMaskTrack = null;
  }
});

const isCustom = computed(() => size.value === "custom");
const endpointOptions = computed(() =>
  config.endpoints.map((endpoint) => ({
    id: endpoint.id,
    label: endpoint.alias || endpoint.model || endpoint.id,
  })),
);

watch(
  () => state.workbenchFill,
  (payload) => {
    if (!payload) return;
    prompt.value = payload.prompt || "";
    if (payload.size) {
      if (SIZE_OPTIONS.includes(payload.size)) {
        size.value = payload.size;
      } else if (/^\d+x\d+$/.test(payload.size)) {
        const [w, h] = payload.size.split("x");
        size.value = "custom";
        width.value = Number(w);
        height.value = Number(h);
      }
      applyModeSize();
    }
    state.workbenchFill = null;
  },
);

watch(
  () => state.workbenchEditFile,
  (file) => {
    if (!file) return;
    setMode("image");
    editFiles.value = [file];
    updateEditPreview();
    state.workbenchEditFile = null;
  },
);

function setMode(next) {
  if (mode.value === "text" && next === "image") {
    textModeSize.value = size.value || "1024x1024";
  }
  mode.value = next;
  if (next === "image") {
    size.value = "auto";
  } else {
    size.value = textModeSize.value || "1024x1024";
  }
}

function applyModeSize() {
  // 分辨率变化通过 v-model 自动生效
}

function updateEditPreview() {
  paintedMaskBlob.value = null;
  maskFile.value = null;
  maskSourceKey.value = "";
  maskPainterOpen.value = false;
  if (editImageUrl.value) URL.revokeObjectURL(editImageUrl.value);
  editImageUrl.value = "";
  if (editFiles.value.length) {
    editImageUrl.value = URL.createObjectURL(editFiles.value[0]);
    editImageName.value = editFiles.value[0].name || "reference.png";
  }
}

function onEditFilesChange(event) {
  editFiles.value = Array.from(event.target.files || []);
  updateEditPreview();
}

function onMaskFileChange(event) {
  paintedMaskBlob.value = null;
  maskFile.value = Array.from(event.target.files || [])[0] || null;
}

function onPaintedMaskSaved(blob) {
  paintedMaskBlob.value = blob;
  maskFile.value = null;
  maskSourceKey.value = `painted-${Date.now()}`;
  maskPainterOpen.value = false;
  toast("蒙版已生成，将随图生图任务提交");
}

const maskStatus = computed(() => {
  if (paintedMaskBlob.value) return "已使用网页涂抹生成的蒙版。";
  if (maskFile.value) return `已选择上传蒙版：${maskFile.value.name}`;
  return "未设置蒙版。";
});

const submitDisabled = ref(false);

async function generate() {
  const text = prompt.value.trim();
  if (!text) {
    toast("请输入提示词");
    return;
  }
  if (mode.value === "image" && !editFiles.value.length) {
    toast("图生图需要上传参考图片");
    return;
  }
  submitDisabled.value = true;
  hint.value = "任务已提交后会立即在浏览器中执行，可在任务列表查看进度和原始错误。";
  try {
    const sizeValue = buildSizeValue({ size: size.value, width: width.value, height: height.value });
    const options = buildImageOptions({
      quality: quality.value,
      style: style.value,
      background: background.value,
      moderation: moderation.value,
      output_format: outputFormat.value,
      output_compression: outputCompression.value,
    });
    const task = submitTask({
      mode: mode.value,
      prompt: text,
      size: sizeValue,
      options,
      files: mode.value === "image" ? editFiles.value : [],
      mask: mode.value === "image" ? paintedMaskBlob.value || maskFile.value : null,
      endpointId: config.active_endpoint_id,
      retries: config.default_retries,
    });
    hint.value = `任务 ${task.id.slice(0, 8)} 已提交，最多尝试 ${task.max_attempts} 次。`;
  } catch (error) {
    hint.value = error.message;
  } finally {
    submitDisabled.value = false;
  }
}

const resultImages = computed(() => state.resultImages);
const resultIndex = computed({
  get: () => state.resultIndex,
  set: (value) => {
    state.resultIndex = value;
  },
});
const resultItem = computed(() => {
  const images = resultImages.value;
  if (!images.length) return null;
  return images[Math.min(state.resultIndex, images.length - 1)];
});
const resultTitle = computed(() => resultItem.value?.title || resultItem.value?.revised_prompt || "未命名图片");

const resultViewerSrc = ref("");
watch(
  () => resultItem.value,
  async (item) => {
    if (!item) {
      resultViewerSrc.value = "";
      return;
    }
    resultViewerSrc.value = item.image_id ? (await ensureImageUrl(item.image_id)) || "" : item.remote_url || "";
  },
  { immediate: true },
);

function openResultLightbox() {
  const item = resultItem.value;
  if (!item) return;
  state.lightbox = {
    url: resultViewerSrc.value || item.remote_url,
    title: resultTitle.value,
    downloadName: `${resultTitle.value}-${item.id.slice(0, 8)}.png`,
    blobId: item.image_id,
    showEdit: true,
  };
}
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Workbench</p>
        <h1>工作台</h1>
      </div>
      <label class="field inline-field">
        <span>当前后端</span>
        <select v-model="config.active_endpoint_id">
          <option v-for="option in endpointOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
        </select>
      </label>
    </div>

    <div class="grid two">
      <section class="panel">
        <div class="panel-head">
          <h2>生成设置</h2>
          <div class="segmented">
            <button class="mode-btn" :class="{ active: mode === 'text' }" type="button" @click="setMode('text')">文生图</button>
            <button class="mode-btn" :class="{ active: mode === 'image' }" type="button" @click="setMode('image')">图生图</button>
          </div>
        </div>

        <label class="field">
          <span>提示词</span>
          <textarea v-model="prompt" rows="9" placeholder="描述画面、风格、构图、光线、材质和需要避免的歧义。"></textarea>
        </label>

        <div v-show="mode === 'image'">
          <div class="edit-uploader">
            <div class="upload-card">
              <label class="field">
                <span>参考图片</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple @change="onEditFilesChange" />
              </label>
              <div class="edit-preview-box" :class="{ empty: !editImageUrl }">
                <template v-if="editImageUrl">
                  <img :src="editImageUrl" alt="图生图参考预览" />
                  <div>
                    <strong>{{ editImageName }}</strong>
                    <p class="muted">{{ editFiles.length > 1 ? `已选择 ${editFiles.length} 张；蒙版基于第一张绘制。` : "已选择 1 张参考图。" }}</p>
                  </div>
                </template>
                <p v-else>选择图片后可直接涂抹蒙版。多图上传时会用第一张图绘制蒙版。</p>
              </div>
            </div>
            <div class="upload-card mask-card">
              <strong>蒙版 Mask</strong>
              <p class="muted">用画笔涂抹需要修改的区域，系统会生成透明区域蒙版并随任务提交。</p>
              <div class="mask-actions">
                <button class="ghost" type="button" @click="editImageUrl ? (maskPainterOpen = true) : toast('请先上传参考图片')">涂抹蒙版</button>
                <button class="ghost" type="button" @click="paintedMaskBlob = null; maskSourceKey = ''">清除涂抹</button>
              </div>
              <label class="field">
                <span>或上传已有 Mask</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" @change="onMaskFileChange" />
              </label>
              <p class="hint">{{ maskStatus }}</p>
            </div>
          </div>
        </div>

        <div class="grid compact">
          <label class="field">
            <span>分辨率</span>
            <select v-model="size">
              <option value="1024x1024">1024 × 1024</option>
              <option value="1536x1024">1536 × 1024</option>
              <option value="1024x1536">1024 × 1536</option>
              <option value="1792x1024">1792 × 1024</option>
              <option value="1024x1792">1024 × 1792</option>
              <option value="2048x2048">2K Square · 2048 × 2048</option>
              <option value="2048x1152">2K Wide · 2048 × 1152</option>
              <option value="1152x2048">2K Tall · 1152 × 2048</option>
              <option value="3840x2160">4K Wide · 3840 × 2160</option>
              <option value="2160x3840">4K Tall · 2160 × 3840</option>
              <option value="512x512">512 × 512</option>
              <option value="256x256">256 × 256</option>
              <option value="auto">auto</option>
              <option value="custom">自定义</option>
            </select>
          </label>
          <label v-show="isCustom" class="field custom-size">
            <span>宽度</span>
            <input v-model.number="width" type="number" min="1" />
          </label>
          <label v-show="isCustom" class="field custom-size">
            <span>高度</span>
            <input v-model.number="height" type="number" min="1" />
          </label>
        </div>
        <details class="advanced">
          <summary>高级参数</summary>
          <div class="grid compact">
            <label class="field">
              <span>质量 quality</span>
              <select v-model="quality">
                <option value="">默认</option>
                <option v-for="value in CHOICES.quality" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <label class="field">
              <span>安全过滤 moderation</span>
              <select v-model="moderation">
                <option value="">默认</option>
                <option v-for="value in CHOICES.moderation" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <label class="field">
              <span>背景 background</span>
              <select v-model="background">
                <option value="">默认</option>
                <option v-for="value in CHOICES.background" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <label class="field">
              <span>输出格式 output_format</span>
              <select v-model="outputFormat">
                <option value="">默认</option>
                <option v-for="value in CHOICES.output_format" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <label class="field">
              <span>压缩率 output_compression</span>
              <input v-model="outputCompression" type="number" min="0" max="100" placeholder="0-100，仅 jpeg/webp" />
            </label>
            <label class="field">
              <span>风格 style</span>
              <select v-model="style">
                <option value="">默认</option>
                <option v-for="value in CHOICES.style" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
          </div>
        </details>

        <button class="primary" type="button" :disabled="submitDisabled" @click="generate">
          {{ submitDisabled ? "提交中..." : "提交生成任务" }}
        </button>
        <p class="hint">{{ hint }}</p>
      </section>

      <section class="panel result-panel">
        <div class="panel-head">
          <h2>本次结果</h2>
          <button class="ghost" type="button" @click="switchPage('gallery')">打开画廊</button>
        </div>
        <div class="result-viewer" :class="{ empty: !resultImages.length }">
          <p v-if="!resultImages.length">生成后的图片会显示在这里，并自动保存到本地画廊。</p>
          <template v-else>
            <div class="result-stage">
              <button class="result-image-btn" type="button" aria-label="查看大图" @click="openResultLightbox">
                <img :src="resultViewerSrc" :alt="resultTitle" />
              </button>
            </div>
            <div class="result-pager">
              <button class="ghost icon-btn" type="button" :disabled="resultImages.length <= 1" @click="resultIndex = Math.max(0, resultIndex - 1)">
                <i class="fa-solid fa-chevron-left"></i>
              </button>
              <strong>{{ resultTitle }}</strong>
              <button class="ghost icon-btn" type="button" :disabled="resultImages.length <= 1" @click="resultIndex = Math.min(resultImages.length - 1, resultIndex + 1)">
                <i class="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </template>
        </div>
      </section>
    </div>

    <section class="panel task-panel">
      <div class="panel-head">
        <h2>任务列表</h2>
        <button class="ghost" type="button" @click="switchPage('tasks')">查看全部任务</button>
      </div>
      <div class="task-list">
        <template v-if="state.tasks.length">
          <TaskCard v-for="task in state.tasks.slice(0, 5)" :key="task.id" :task="task" />
        </template>
        <p v-else class="muted">暂无任务。</p>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="maskPainterOpen" ref="maskModalRef" class="modal" @click.self="maskPainterOpen = false">
        <MaskPainter :source-url="editImageUrl" :source-key="editImageUrl" @close="maskPainterOpen = false" @saved="onPaintedMaskSaved" />
      </div>
    </Teleport>
  </section>
</template>
