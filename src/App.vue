<script setup>
import { computed, onMounted, watch } from "vue";
import { config, state, switchPage, setSidebarCollapsed, clampNumber } from "./store.js";
import WorkbenchPage from "./components/WorkbenchPage.vue";
import TasksPage from "./components/TasksPage.vue";
import GalleryPage from "./components/GalleryPage.vue";
import PromptsPage from "./components/PromptsPage.vue";
import SettingsPage from "./components/SettingsPage.vue";
import PromptDialog from "./components/PromptDialog.vue";
import ImageEditDialog from "./components/ImageEditDialog.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import Lightbox from "./components/Lightbox.vue";

const NAV_ITEMS = [
  { page: "workbench", icon: "fa-solid fa-wand-magic-sparkles", label: "工作台" },
  { page: "tasks", icon: "fa-solid fa-list-check", label: "任务" },
  { page: "gallery", icon: "fa-regular fa-images", label: "画廊" },
  { page: "prompts", icon: "fa-regular fa-bookmark", label: "提示词" },
  { page: "settings", icon: "fa-solid fa-gear", label: "设置" },
];

function openMobileNav() {
  state.mobileNavOpen = true;
}

function closeMobileNav() {
  state.mobileNavOpen = false;
}

function toggleSidebar() {
  setSidebarCollapsed(!state.sidebarCollapsed);
}

function applyAppearance() {
  const root = document.documentElement;
  root.style.setProperty(
    "--app-bg-image",
    config.web_background_url ? `url("${config.web_background_url.replaceAll('"', "%22")}")` : "none",
  );
  root.style.setProperty("--app-bg-opacity", String(clampNumber(config.web_background_opacity, 0.22, 0, 1)));
  root.dataset.theme = config.color_theme;
}

const DEFAULT_FAVICON = "./favicon.svg";

function applyWebIcon() {
  const favicon = document.getElementById("faviconLink");
  if (!favicon) return;
  favicon.setAttribute("href", config.web_icon_url || DEFAULT_FAVICON);
}

watch(() => [config.web_background_url, config.web_background_opacity, config.color_theme], applyAppearance);
watch(() => config.web_icon_url, applyWebIcon);

onMounted(() => {
  applyAppearance();
  applyWebIcon();
});
</script>

<template>
  <button class="mobile-menu-btn" type="button" aria-label="打开导航" @click="openMobileNav">
    <i class="fa-solid fa-bars"></i>
  </button>
  <div class="mobile-nav-backdrop" :class="{ hidden: !state.mobileNavOpen }" @click="closeMobileNav"></div>
  <div class="shell">
    <aside class="sidebar" :class="{ open: state.mobileNavOpen }">
      <div class="brand">
        <span class="brand-mark app-brand-mark">G</span>
        <div class="brand-copy">
          <strong>GPT 绘图工作台</strong>
          <small>Generations · Edits · Gallery</small>
        </div>
      </div>
      <nav class="nav">
        <button
          v-for="item in NAV_ITEMS"
          :key="item.page"
          class="nav-item"
          :class="{ active: state.page === item.page }"
          type="button"
          @click="switchPage(item.page)"
        >
          <i :class="item.icon"></i><span>{{ item.label }}</span>
        </button>
      </nav>
      <button class="collapse-btn" type="button" :title="state.sidebarCollapsed ? '展开侧栏' : '收起侧栏'" @click="toggleSidebar">
        <i :class="state.sidebarCollapsed ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left'"></i>
        <span>{{ state.sidebarCollapsed ? "展开侧栏" : "收起侧栏" }}</span>
      </button>
    </aside>

    <main class="main">
      <WorkbenchPage :class="{ active: state.page === 'workbench' }" />
      <TasksPage :class="{ active: state.page === 'tasks' }" />
      <GalleryPage :class="{ active: state.page === 'gallery' }" />
      <PromptsPage :class="{ active: state.page === 'prompts' }" />
      <SettingsPage :class="{ active: state.page === 'settings' }" />
    </main>
  </div>

  <PromptDialog />
  <ImageEditDialog />
  <ConfirmDialog />
  <Lightbox />
  <div class="toast" :class="{ hidden: !state.toastMessage }">{{ state.toastMessage }}</div>
</template>
