<template>
  <div class="app-progress-bar" role="progressbar" :aria-valuenow="value" aria-valuemin="0" aria-valuemax="100">
    <div class="app-progress-bar__fill" :style="{ width: `${Math.min(100, Math.max(0, value))}%` }" />
  </div>
</template>

<script setup>
defineProps({
  value: {
    type: Number,
    default: 0,
  },
})
</script>

<style scoped>
.app-progress-bar {
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--border);
  overflow: hidden;
}

.app-progress-bar__fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--accent);
  transition: width .4s ease;
}
</style>
