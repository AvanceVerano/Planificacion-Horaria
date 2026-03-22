<template>
  <button class="app-btn-primary" v-bind="$attrs" @click="$emit('click', $event)">
    <slot />
  </button>
</template>

<script setup>
defineEmits(['click'])
</script>

<style scoped>
.app-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--primary);
  color: #fff;
  border: none;
  padding: 12px 20px;
  font-size: 15px;
  font-family: 'Public Sans', sans-serif;
  font-weight: 700;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background .2s, box-shadow .2s;
  box-sizing: border-box;
}

.app-btn-primary:hover {
  background: var(--primary-dark);
  box-shadow: 0 4px 12px rgba(139,94,60,.3);
}

.app-btn-primary:disabled {
  background: var(--border);
  color: var(--text-muted);
  cursor: not-allowed;
  box-shadow: none;
}
</style>
