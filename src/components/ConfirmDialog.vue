<script setup>
import { nextTick, ref, watch } from "vue";
import { state, resolveConfirm } from "../store.js";
import { fixModalGeometry, trackModalGeometry } from "../lib/modalFix.js";

const modalRef = ref(null);
let releaseTrack = null;

watch(
  () => Boolean(state.confirmRequest),
  async (open) => {
    if (open) {
      await nextTick();
      await fixModalGeometry(modalRef.value);
      releaseTrack?.();
      releaseTrack = trackModalGeometry(modalRef.value);
    } else {
      releaseTrack?.();
      releaseTrack = null;
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <div ref="modalRef" v-if="state.confirmRequest" class="modal" @click.self="resolveConfirm(false)">
      <div class="modal-card confirm-card">
        <h2>{{ state.confirmRequest.title }}</h2>
        <p class="muted">{{ state.confirmRequest.message }}</p>
        <div class="dialog-actions">
          <button class="ghost danger" type="button" @click="resolveConfirm(true)">确认</button>
          <button class="primary" type="button" @click="resolveConfirm(false)">取消</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
