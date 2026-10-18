<script setup>
import { state, resolveConfirm } from "../store.js";
</script>

<template>
  <div v-if="state.confirmRequest" class="modal" @click.self="resolveConfirm(false)">
    <div class="modal-card confirm-card">
      <h2>{{ state.confirmRequest.title }}</h2>
      <p class="muted">{{ state.confirmRequest.message }}</p>
      <div class="dialog-actions">
        <button class="ghost danger" type="button" @click="resolveConfirm(true)">确认</button>
        <button class="primary" type="button" @click="resolveConfirm(false)">取消</button>
      </div>
    </div>
  </div>
</template>
