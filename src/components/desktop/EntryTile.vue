<script setup lang="ts">
import { computed } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import TotpCode from '@/components/TotpCode.vue';
import { DEFAULT_GROUP } from '@/types/totp';
import type { TotpEntry } from '@/types/totp';

const props = defineProps<{ entry: TotpEntry }>();
const emit = defineEmits<{ edit: []; delete: [] }>();

const group = computed(() => props.entry.group.trim() || DEFAULT_GROUP);
const meta = computed(() => {
  const entry = props.entry;
  if (entry.advanced.type === 'STEAM') return 'Steam Guard · 30 秒';
  return `${entry.advanced.algorithm} · ${entry.advanced.digits} 位 · ${entry.advanced.period} 秒`;
});
</script>

<template>
  <article class="entry-tile" @click="emit('edit')">
    <header class="tile-head">
      <div class="tile-title">
        <h3>{{ entry.issuer }}</h3>
        <span class="tile-name">{{ entry.name }}</span>
      </div>
      <span class="group-pill">{{ group }}</span>
    </header>

    <TotpCode :entry="entry" size="md" />

    <footer class="tile-foot">
      <p class="tile-note" :title="entry.note || meta">{{ entry.note || meta }}</p>
      <div class="tile-actions">
        <button type="button" class="icon-btn" title="编辑" @click.stop="emit('edit')">
          <AppIcon name="edit" :size="15" />
        </button>
        <button type="button" class="icon-btn danger" title="删除" @click.stop="emit('delete')">
          <AppIcon name="trash" :size="15" />
        </button>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.entry-tile {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 15px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.entry-tile:hover {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.entry-tile :deep(.totp-code) {
  width: 100%;
}

.tile-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.tile-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.tile-title h3 {
  margin: 0;
  flex: none;
  max-width: 60%;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-name {
  min-width: 0;
  font-size: 11.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-pill {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--primary-ghost);
  color: var(--primary-strong);
  font-size: 10.5px;
  font-weight: 500;
}

.tile-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
}

.tile-note {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-actions {
  display: inline-flex;
  flex: none;
  gap: 1px;
  opacity: 0.4;
  transition: opacity 0.16s ease;
}

.entry-tile:hover .tile-actions,
.entry-tile:focus-within .tile-actions {
  opacity: 1;
}

.tile-actions .icon-btn {
  width: 28px;
  height: 28px;
}
</style>
