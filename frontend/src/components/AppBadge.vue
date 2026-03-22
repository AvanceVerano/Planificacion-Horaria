<template>
  <span class="app-badge" :class="`app-badge--${variant}`">
    <slot />
  </span>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'neutral',
    validator: (v) => ['success', 'warning', 'error', 'info', 'neutral'].includes(v),
  },
})
</script>

<style scoped>
.app-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 700;
  font-family: 'Public Sans', sans-serif;
}

.app-badge--success  { background: #e6f4ea; color: #2e7d32; }
.app-badge--warning  { background: #fff3e0; color: #e65100; }
.app-badge--error    { background: #fdecea; color: #c62828; }
.app-badge--info     { background: #e3f2fd; color: #1565c0; }
.app-badge--neutral  { background: var(--border); color: var(--text); }
</style>
