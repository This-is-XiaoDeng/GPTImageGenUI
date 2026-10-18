<script setup>
import { nextTick, reactive, ref, watch } from "vue";
import { loadImage } from "../lib/util.js";

const props = defineProps({
  sourceUrl: { type: String, default: "" },
  sourceKey: { type: String, default: "" },
});
const emit = defineEmits(["close", "saved"]);

const brushSize = ref(48);
const canvasRef = ref(null);
const local = reactive({
  ready: false,
  drawing: false,
  scale: 1,
  sourceWidth: 0,
  sourceHeight: 0,
  loadedKey: "",
  history: [],
});

let baseImage = null;
let paintCanvas = null;

watch(
  () => [props.sourceUrl, props.sourceKey],
  async ([url, key]) => {
    if (!url) return;
    if (local.loadedKey === key && paintCanvas) {
      local.ready = true;
      await nextTick();
      render();
      return;
    }
    await setup(url, key);
  },
  { immediate: true },
);

async function setup(url, key) {
  const image = await loadImage(url);
  baseImage = image;
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  local.sourceWidth = image.naturalWidth;
  local.sourceHeight = image.naturalHeight;
  local.scale = scale;
  local.loadedKey = key;
  await nextTick();
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  paintCanvas = document.createElement("canvas");
  paintCanvas.width = canvas.width;
  paintCanvas.height = canvas.height;
  local.history = [paintCanvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height)];
  local.ready = true;
  render();
}

function render() {
  const canvas = canvasRef.value;
  if (!canvas || !canvas.width || !baseImage) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
  if (!paintCanvas) return;
  const overlay = document.createElement("canvas");
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  const overlayCtx = overlay.getContext("2d");
  overlayCtx.fillStyle = "rgba(200, 82, 27, 0.34)";
  overlayCtx.fillRect(0, 0, overlay.width, overlay.height);
  overlayCtx.globalCompositeOperation = "destination-in";
  overlayCtx.drawImage(paintCanvas, 0, 0);
  ctx.drawImage(overlay, 0, 0);
}

function pointerPosition(event) {
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function beginStroke(event) {
  if (!local.ready || !paintCanvas) return;
  local.drawing = true;
  canvasRef.value.setPointerCapture(event.pointerId);
  const ctx = paintCanvas.getContext("2d");
  const pos = pointerPosition(event);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.strokeStyle = "rgba(255, 255, 255, 1)";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Number(brushSize.value);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.fill();
  render();
}

function continueStroke(event) {
  if (!local.drawing) return;
  const ctx = paintCanvas.getContext("2d");
  const pos = pointerPosition(event);
  ctx.lineWidth = Number(brushSize.value);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  render();
}

function endStroke() {
  if (!local.drawing) return;
  local.drawing = false;
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = paintCanvas.getContext("2d");
  local.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (local.history.length > 20) local.history.shift();
}

function undo() {
  if (local.history.length <= 1 || !paintCanvas) return;
  local.history.pop();
  paintCanvas.getContext("2d").putImageData(local.history[local.history.length - 1], 0, 0);
  render();
}

function clear() {
  if (!paintCanvas) return;
  const ctx = paintCanvas.getContext("2d");
  ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
  local.history = [ctx.getImageData(0, 0, paintCanvas.width, paintCanvas.height)];
  render();
}

async function save() {
  const canvas = canvasRef.value;
  if (!paintCanvas || !canvas) {
    return;
  }
  const source = paintCanvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  const small = document.createElement("canvas");
  small.width = canvas.width;
  small.height = canvas.height;
  const smallCtx = small.getContext("2d");
  const mask = smallCtx.createImageData(small.width, small.height);
  for (let i = 0; i < source.data.length; i += 4) {
    const edited = source.data[i + 3] > 0;
    mask.data[i] = 0;
    mask.data[i + 1] = 0;
    mask.data[i + 2] = 0;
    mask.data[i + 3] = edited ? 0 : 255;
  }
  smallCtx.putImageData(mask, 0, 0);
  const output = document.createElement("canvas");
  output.width = local.sourceWidth || canvas.width;
  output.height = local.sourceHeight || canvas.height;
  const ctx = output.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, output.width, output.height);
  const blob = await new Promise((resolve) => output.toBlob(resolve, "image/png"));
  if (blob) emit("saved", blob);
}
</script>

<template>
  <div class="mask-painter-card">
    <div class="panel-head">
      <div>
        <h2>涂抹蒙版</h2>
        <p class="muted">黑色保留原图，涂抹区域会变透明并交给模型编辑。</p>
      </div>
      <button class="ghost" type="button" @click="emit('close')">关闭</button>
    </div>
    <div class="mask-toolbar">
      <label class="field">
        <span>画笔大小</span>
        <input v-model.number="brushSize" type="range" min="8" max="160" />
      </label>
      <button class="ghost" type="button" @click="undo"><i class="fa-solid fa-rotate-left"></i> 撤销</button>
      <button class="ghost" type="button" @click="clear"><i class="fa-solid fa-eraser"></i> 清空</button>
      <button class="primary narrow" type="button" @click="save">使用此蒙版</button>
    </div>
    <div class="mask-canvas-wrap">
      <canvas ref="canvasRef" @pointerdown="beginStroke" @pointermove="continueStroke" @pointerup="endStroke" @pointercancel="endStroke"></canvas>
    </div>
  </div>
</template>
