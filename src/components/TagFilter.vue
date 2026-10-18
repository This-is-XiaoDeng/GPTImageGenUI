<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
  tags: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] },
});
const emit = defineEmits(["update:modelValue", "clear"]);

const open = ref(false);
const root = ref(null);

function onDocumentClick(event) {
  if (root.value && !root.value.contains(event.target)) open.value = false;
}

onMounted(() => document.addEventListener("click", onDocumentClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocumentClick));

function toggle() {
  open.value = !open.value;
}

function onCheckboxChange(event) {
  if (event.target.type !== "checkbox") return;
  const checked = Array.from(root.value.querySelectorAll("input[type='checkbox']:checked")).map(
    (input) => input.value,
  );
  emit("update:modelValue", checked);
}

function clearAll() {
  open.value = false;
  emit("update:modelValue", []);
}
</script>

<template>
  <div ref="root" class="tag-filter">
    <button class="filter-button" type="button" @click="toggle">
      <span>{{ modelValue.length ? `已选择 ${modelValue.length} 个标签` : "全部标签" }}</span>
      <i class="fa-solid fa-chevron-down"></i>
    </button>
    <div v-show="open" class="tag-filter-menu">
      <button class="tag-clear" type="button" @click="clearAll">清除选择</button>
      <p v-if="!tags.length" class="muted">暂无标签</p>
      <div v-else class="tag-options">
        <label v-for="tag in tags" :key="tag" class="tag-option">
          <input type="checkbox" :value="tag" :checked="modelValue.includes(tag)" @change="onCheckboxChange" />
          <span>{{ tag }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
