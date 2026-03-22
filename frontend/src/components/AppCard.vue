<template>
  <div class="app-card" :class="$attrs.class">
    <slot />
  </div>
</template>

<style scoped>
.app-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: var(--space);
}
</style>
