<script setup lang="ts">
import { computed } from 'vue';

import type { IconName } from './icons';
import { ICON_PATHS } from './icons';

const props = withDefaults(defineProps<{ name: IconName; size?: number; strokeWidth?: number }>(), {
  size: 20,
  strokeWidth: 1.8
});

const paths = computed<readonly string[]>(() => ICON_PATHS[props.name] ?? []);
</script>

<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(path, index) in paths" :key="index" :d="path" />
  </svg>
</template>

<style scoped>
.app-icon {
  flex: none;
  display: block;
}
</style>
