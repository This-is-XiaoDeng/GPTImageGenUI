<script setup>
import { computed, ref, watch } from "vue";
import { state, db, toast, normalizeTags, confirmAction } from "../store.js";
import { deleteImage } from "../lib/imageDb.js";

const visible = computed(() => Boolean(state.imageEditDialog));

const form = ref({ title: "", tags: "", archived: false });
let editingId = "";

watch(
  () => state.imageEditDialog,
  async (id) => {
    if (!id) return;
    const item = db.images.find((image) => image.id === id);
    if (!item) {
      state.imageEditDialog = null;
      return;
    }
    editingId = id;
    form.value = {
      title: item.title || item.revised_prompt || "",
      tags: (item.tags || []).join(", "),
      archived: Boolean(item.archived),
    };
  },
);

function close() {
  state.imageEditDialog = null;
}

async function save() {
  const item = db.images.find((image) => image.id === editingId);
  if (!item) return;
  item.title = form.value.title.trim();
  item.tags = normalizeTags(form.value.tags);
  item.archived = Boolean(form.value.archived);
  close();
  toast("图片信息已保存");
}

async function remove() {
  const item = db.images.find((image) => image.id === editingId);
  const title = form.value.title || "这张图片";
  const confirmed = await confirmAction("删除图片", `确认删除「${title}」？此操作会删除本地保存的图片。`);
  if (!confirmed) return;
  await deleteImage(item.image_id);
  await deleteImage(item.source_image_id);
  const index = db.images.findIndex((image) => image.id === editingId);
  if (index >= 0) db.images.splice(index, 1);
  close();
  toast("图片已删除");
}
</script>

<template>
  <div v-if="visible" class="modal" @click.self="close">
    <form class="modal-card" @submit.prevent="save">
      <div class="panel-head">
        <h2>编辑图片信息</h2>
        <button class="ghost" type="button" @click="close">关闭</button>
      </div>
      <label class="field">
        <span>标题</span>
        <input v-model="form.title" placeholder="图片标题" />
      </label>
      <label class="field">
        <span>标签</span>
        <input v-model="form.tags" placeholder="逗号或空格分隔" />
      </label>
      <label class="check-row">
        <input v-model="form.archived" type="checkbox" />
        <span>归档这张图片</span>
      </label>
      <div class="dialog-actions">
        <button class="primary" type="submit">保存</button>
        <button class="ghost danger" type="button" @click="remove">删除图片</button>
      </div>
    </form>
  </div>
</template>
