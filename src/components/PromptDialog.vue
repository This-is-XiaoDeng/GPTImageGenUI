<script setup>
import { computed, ref, watch } from "vue";
import { state, db, toast, normalizeTags } from "../store.js";
import { putImage, deleteImage, ensureImageUrl } from "../lib/imageDb.js";

const visible = computed(() => Boolean(state.promptDialog));
const isEdit = computed(() => state.promptDialog?.mode === "edit");

const form = ref({ title: "", prompt: "", tags: "" });
const referenceUrl = ref("");
const referenceFile = ref(null);
const clearReference = ref(false);

watch(
  () => state.promptDialog,
  async (dialog) => {
    if (!dialog) return;
    referenceFile.value = null;
    clearReference.value = false;
    if (dialog.mode === "edit") {
      const item = db.prompts.find((prompt) => prompt.id === dialog.id);
      if (!item) {
        state.promptDialog = null;
        return;
      }
      form.value = {
        title: item.title || "",
        prompt: item.prompt || "",
        tags: (item.tags || []).join(", "),
      };
      referenceUrl.value = item.reference_image_id ? await previewRef(item.reference_image_id) : "";
    } else {
      form.value = { title: "", prompt: "", tags: "" };
      referenceUrl.value = "";
    }
  },
);

async function previewRef(id) {
  return ensureImageUrl(id);
}

function onReferenceChange(event) {
  const file = event.target.files?.[0];
  referenceFile.value = file || null;
  clearReference.value = false;
  referenceUrl.value = file ? URL.createObjectURL(file) : referenceUrl.value;
  if (!file) referenceUrl.value = "";
}

function toggleClearReference(event) {
  clearReference.value = event.target.checked;
  if (clearReference.value) {
    referenceFile.value = null;
    referenceUrl.value = "";
  } else if (isEdit.value && state.promptDialog) {
    const item = db.prompts.find((prompt) => prompt.id === state.promptDialog.id);
    loadExistingReference(item);
  }
}

async function loadExistingReference(item) {
  referenceUrl.value = item?.reference_image_id ? (await ensureImageUrl(item.reference_image_id)) || "" : "";
}

function close() {
  state.promptDialog = null;
}

async function save() {
  const text = form.value.prompt.trim();
  if (!text) {
    toast("提示词不能为空");
    return;
  }
  const title = form.value.title.trim() || text.slice(0, 28);
  const tags = normalizeTags(form.value.tags);
  if (isEdit.value) {
    const item = db.prompts.find((prompt) => prompt.id === state.promptDialog.id);
    if (!item) return;
    item.title = title;
    item.prompt = text;
    item.tags = tags;
    if (clearReference.value) {
      await deleteImage(item.reference_image_id);
      item.reference_image_id = "";
    } else if (referenceFile.value) {
      if (item.reference_image_id) await deleteImage(item.reference_image_id);
      const refId = `pref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await putImage(refId, referenceFile.value);
      item.reference_image_id = refId;
    }
    toast("提示词已更新");
  } else {
    let refId = "";
    if (referenceFile.value) {
      refId = `pref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        await putImage(refId, referenceFile.value);
      } catch (error) {
        console.warn("保存参考图失败", error);
        toast("参考图保存失败（存储空间不足）");
        refId = "";
      }
    }
    db.prompts.unshift({
      id: `prompt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      prompt: text,
      tags,
      reference_image_id: refId,
      created_at: Math.floor(Date.now() / 1000),
    });
    toast("提示词已保存");
  }
  close();
}
</script>

<template>
  <div v-if="visible" class="modal" @click.self="close">
    <form class="modal-card" @submit.prevent="save">
      <div class="panel-head">
        <h2>{{ isEdit ? "编辑提示词" : "添加提示词" }}</h2>
        <button class="ghost" type="button" @click="close">关闭</button>
      </div>
      <label class="field">
        <span>标题</span>
        <input v-model="form.title" placeholder="例如：产品摄影 / 奇幻角色 / 建筑概念" />
      </label>
      <label class="field">
        <span>提示词</span>
        <textarea v-model="form.prompt" rows="7" placeholder="保存常用提示词，之后可一键填充到工作台。"></textarea>
      </label>
      <label class="field">
        <span>标签</span>
        <input v-model="form.tags" placeholder="逗号或空格分隔" />
      </label>
      <label class="field">
        <span>参考图（仅展示）</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" @change="onReferenceChange" />
      </label>
      <div class="reference-preview" :class="{ empty: !referenceUrl }">
        <img v-if="referenceUrl" :src="referenceUrl" alt="参考图" />
        <p v-else class="muted">未添加参考图。</p>
      </div>
      <label v-if="isEdit" class="check-row">
        <input type="checkbox" :checked="clearReference" @change="toggleClearReference" />
        <span>移除当前参考图</span>
      </label>
      <button class="primary" type="submit">{{ isEdit ? "保存修改" : "保存提示词" }}</button>
    </form>
  </div>
</template>
