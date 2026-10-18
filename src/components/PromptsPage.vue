<script setup>
import { computed } from "vue";
import { state, db } from "../store.js";
import PromptCard from "./PromptCard.vue";
import TagFilter from "./TagFilter.vue";

const prompts = computed(() => {
  const q = state.promptSearch.trim().toLowerCase();
  let list = db.prompts;
  if (q) {
    list = list.filter((item) =>
      [item.title, item.prompt, ...(item.tags || [])].join(" ").toLowerCase().includes(q),
    );
  }
  if (state.selectedPromptTags.length) {
    const selected = new Set(state.selectedPromptTags.map((tag) => tag.toLowerCase()));
    list = list.filter((item) => {
      const tags = new Set((item.tags || []).map((tag) => tag.toLowerCase()));
      return [...selected].every((tag) => tags.has(tag));
    });
  }
  return list;
});

const availableTags = computed(() =>
  [...new Set(db.prompts.flatMap((item) => item.tags || []))].sort((a, b) => a.localeCompare(b)),
);
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Prompt Library</p>
        <h1>提示词收集</h1>
      </div>
      <button class="primary narrow" type="button" @click="state.promptDialog = { mode: 'add' }">添加提示词</button>
    </div>
    <section class="panel">
      <div class="panel-head">
        <h2>收藏列表</h2>
        <div class="prompt-toolbar">
          <input v-model="state.promptSearch" type="search" placeholder="搜索提示词" />
          <TagFilter v-model="state.selectedPromptTags" :tags="availableTags" />
        </div>
      </div>
      <div class="prompt-list">
        <template v-if="prompts.length">
          <PromptCard v-for="item in prompts" :key="item.id" :item="item" @edit="state.promptDialog = { mode: 'edit', id: $event }" />
        </template>
        <p v-else class="muted">还没有收藏提示词。</p>
      </div>
    </section>
  </section>
</template>
