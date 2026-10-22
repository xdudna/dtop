<script setup lang="ts">
import { computed } from 'vue';

import { useNow } from '@/composables/useNow';
import { formatTime } from '@/utils/format';

import AppIcon from './AppIcon.vue';

/** 统一 30 秒时间窗口（TOTP 与 Steam 的默认周期） */
const WINDOW = 30;

const now = useNow();
const timeText = computed(() => formatTime(now.value));
const secondsLeft = computed(() => WINDOW - (Math.floor(now.value / 1000) % WINDOW));
const progress = computed(() => secondsLeft.value / WINDOW);
const urgent = computed(() => secondsLeft.value <= 5);
</script>

<template>
  <div
    class="time-bar"
    :class="{ urgent }"
    role="timer"
    :aria-label="`当前时间 ${timeText}，${secondsLeft} 秒后刷新`"
  >
    <AppIcon name="clock" :size="17" class="time-icon" />
    <span class="time-now">{{ timeText }}</span>
    <span class="time-track" aria-hidden="true">
      <span class="time-fill" :style="{ width: `${progress * 100}%` }"></span>
    </span>
    <span class="time-left">{{ secondsLeft }}s</span>
  </div>
</template>

<style scoped>
.time-bar {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  width: 290px;
  max-width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-secondary);
  transition: border-color 0.2s ease;
}

.time-icon {
  flex: none;
  color: var(--text-muted);
}

.time-now {
  flex: none;
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: 0.03em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.time-track {
  display: block;
  flex: 1;
  min-width: 36px;
  height: 5px;
  border-radius: 999px;
  background: var(--progress-track);
  overflow: hidden;
}

.time-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--primary), var(--primary-soft));
  transition: width 0.45s linear;
}

.time-left {
  flex: none;
  min-width: 26px;
  font-size: 12px;
  text-align: right;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.time-bar.urgent {
  border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
}

.urgent .time-fill {
  background: var(--danger);
}

.urgent .time-left {
  color: var(--danger);
  font-weight: 600;
}

@media (max-width: 767px) {
  .time-bar {
    width: 100%;
    padding: 9px 13px;
  }

  .time-now {
    font-size: 20px;
  }

  .time-left {
    font-size: 12.5px;
  }
}
</style>
