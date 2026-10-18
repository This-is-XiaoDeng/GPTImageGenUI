<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { state, db } from "../store.js";
import ImageCard from "./ImageCard.vue";
import TagFilter from "./TagFilter.vue";

const images = computed(() => {
  const q = state.gallerySearch.trim().toLowerCase();
  let list = db.images;
  if (!state.showArchivedImages) {
    list = list.filter((item) => !item.archived);
  }
  if (q) {
    list = list.filter(
      (item) =>
        q in (item.prompt || "").toLowerCase() ||
        q in (item.title || "").toLowerCase() ||
        q in (item.revised_prompt || "").toLowerCase() ||
        q in (item.size || "").toLowerCase() ||
        q in (item.model || "").toLowerCase() ||
        (item.tags || []).some((tag) => q in tag.toLowerCase()),
    );
  }
  if (state.selectedGalleryTags.length) {
    const selected = new Set(state.selectedGalleryTags.map((tag) => tag.toLowerCase()));
    list = list.filter((item) => {
      const tags = new Set((item.tags || []).map((tag) => tag.toLowerCase()));
      return [...selected].every((tag) => tags.has(tag));
    });
  }
  return list;
});

const availableTags = computed(() => {
  const base = state.showArchivedImages ? db.images : db.images.filter((item) => !item.archived);
  return [...new Set(base.flatMap((item) => item.tags || []))].sort((a, b) => a.localeCompare(b));
});

const columns = ref(3);
const gridRef = ref(null);

function updateColumns() {
  const width = gridRef.value?.clientWidth || window.innerWidth;
  if (width < 680) columns.value = 1;
  else if (width < 1120) columns.value = 2;
  else if (width < 1500) columns.value = 3;
  else columns.value = 4;
}

const columnItems = computed(() => {
  const result = Array.from({ length: columns.value }, () => []);
  images.value.forEach((item, index) => result[index % columns.value].push(item));
  return result;
});

let resizeTimer = 0;
function onResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(updateColumns, 150);
}

onMounted(() => {
  updateColumns();
  window.addEventListener("resize", onResize);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  window.clearTimeout(resizeTimer);
});
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">GALLERY</p>
        <h1>画廊</h1>
      </div>
      <div class="gallery-toolbar">
        <input v-model="state.gallerySearch" type="search" placeholder="搜索提示词、模型、标签、分辨率" />
        <TagFilter v-model="state.selectedGalleryTags" :tags="availableTags" />
        <label class="archive-toggle">
          <input v-model="state.showArchivedImages" type="checkbox" />
          <span>显示归档图片</span>
        </label>
      </div>
    </div>
    <div ref="gridRef" class="gallery-grid" :style="{ '--gallery-columns': columns }">
      <section v-if="!images.length" class="panel">
        <p class="muted">暂无图片。生成图片后会自动出现在这里。</p>
      </section>
      <template v-else>
        <div v-for="(items, index) in columnItems" :key="index" class="gallery-column">
          <ImageCard v-for="item in items" :key="item.id" :item="item" @edit="state.imageEditDialog = $event" />
        </div>
      </template>
    </div>
  </section>
</template>
