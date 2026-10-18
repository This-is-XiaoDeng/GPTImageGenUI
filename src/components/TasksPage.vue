<script setup>
import { computed } from "vue";
import { state, toast, confirmAction } from "../store.js";
import { clearTaskHistory } from "../lib/tasks.js";
import TaskCard from "./TaskCard.vue";

const tasks = computed(() => state.tasks);
const hasActiveTasks = computed(() =>
  state.tasks.some((task) => ["queued", "running"].includes(task.status)),
);
const canClear = computed(() => {
  return (
    state.tasks.length > 0 &&
    !hasActiveTasks.value &&
    state.tasks.some((task) => ["succeeded", "failed", "cancelled"].includes(task.status))
  );
});

async function clearHistory() {
  const finishedTasks = state.tasks.filter((task) =>
    ["succeeded", "failed", "cancelled"].includes(task.status),
  );
  if (!finishedTasks.length) {
    toast("当前没有可清空的任务历史");
    return;
  }
  const confirmed = await confirmAction(
    "清空任务历史",
    `确认清空 ${finishedTasks.length} 条任务历史？进行中的任务不会被删除。`,
  );
  if (!confirmed) return;
  clearTaskHistory();
  toast("任务历史已清空");
}
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Jobs</p>
        <h1>任务列表</h1>
      </div>
      <div class="toolbar task-toolbar">
        <button v-show="canClear" class="ghost danger" type="button" @click="clearHistory">清空历史</button>
        <button class="ghost" type="button" @click="toast('任务列表已刷新')">刷新</button>
      </div>
    </div>
    <section class="panel">
      <div class="task-list">
        <template v-if="tasks.length">
          <TaskCard v-for="task in tasks" :key="task.id" :task="task" />
        </template>
        <p v-else class="muted">暂无任务。提交生成后会显示状态、重试次数和错误详情。</p>
      </div>
    </section>
  </section>
</template>
