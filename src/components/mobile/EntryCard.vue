<script setup lang="ts">
import { computed } from 'vue';

import TotpCode from '@/components/TotpCode.vue';
import { DEFAULT_GROUP } from '@/types/totp';
import type { TotpEntry } from '@/types/totp';

const props = withDefaults(defineProps<{ entry: TotpEntry; compact?: boolean }>(), {
  compact: false
});
const emit = defineEmits<{ edit: []; delete: [] }>();

const group = computed(() => props.entry.group.trim() || DEFAULT_GROUP);
</script>

<template>
  <van-swipe-cell class="entry-swipe">
    <article class="entry-card" :class="{ 'is-compact': props.compact }" @click="emit('edit')">
      <header class="entry-head">
        <div class="entry-title">
          <h3>{{ entry.issuer }}</h3>
          <span class="entry-name">{{ entry.name }}</span>
        </div>
        <span class="group-pill">{{ group }}</span>
      </header>

      <TotpCode
        :entry="entry"
        :size="props.compact ? 'sm' : 'lg'"
        :orientation="props.compact ? 'vertical' : 'horizontal'"
      />

      <p v-if="entry.note" class="entry-note">{{ entry.note }}</p>
    </article>

    <template #right>
      <button type="button" class="swipe-delete" @click="emit('delete')">删除</button>
    </template>
  </van-swipe-cell>
</template>

<style scoped>
.entry-swipe {
  height: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.entry-swipe :deep(.van-swipe-cell__wrapper) {
  height: 100%;
}

.entry-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 14px 16px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.entry-card:active {
  transform: scale(0.995);
  border-color: var(--primary);
}

.entry-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.entry-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.entry-title h3 {
  margin: 0;
  flex: none;
  max-width: 62%;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-name {
  min-width: 0;
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-pill {
  flex: none;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--primary-ghost);
  color: var(--primary-strong);
  font-size: 11px;
  font-weight: 500;
}

.entry-note {
  margin: 0;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.swipe-delete {
  height: 100%;
  width: 84px;
  border: 0;
  background: var(--danger);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

/* ---------- 一行 2 条的紧凑卡片 ---------- */

.entry-card.is-compact {
  gap: 8px;
  padding: 11px 12px 9px;
  border-radius: 14px;
}

.is-compact .entry-head {
  gap: 6px;
}

.is-compact .entry-title {
  gap: 5px;
}

.is-compact .entry-title h3 {
  font-size: 13px;
}

.is-compact .entry-name {
  font-size: 10.5px;
}

.is-compact .group-pill {
  max-width: 54px;
  padding: 2px 6px;
  font-size: 9.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.is-compact .entry-note {
  padding-top: 7px;
  font-size: 10.5px;
  -webkit-line-clamp: 1;
}

.is-compact :deep(.totp-code) {
  gap: 4px;
  padding: 0;
}

.is-compact :deep(.code-progress) {
  gap: 5px;
}

.is-compact :deep(.bar) {
  height: 3px;
}

.is-compact :deep(.seconds) {
  min-width: 18px;
  font-size: 9.5px;
}

.is-compact :deep(.copy-hint) {
  display: none;
}

.is-compact .swipe-delete {
  width: 68px;
  font-size: 13px;
}
</style>
