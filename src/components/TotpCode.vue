<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';

import { useTotpWheel } from '@/composables/useTotpWheel';
import { formatTotpCode } from '@/crypto/totp';
import { useSettingsStore } from '@/stores/settingsStore';
import type { TotpEntry } from '@/types/totp';
import { copyText, scheduleClipboardClear } from '@/utils/clipboard';
import { toast } from '@/utils/feedback';

import AppIcon from './AppIcon.vue';

const props = withDefaults(
  defineProps<{
    entry: TotpEntry;
    size?: 'sm' | 'md' | 'lg';
    orientation?: 'horizontal' | 'vertical';
    showProgress?: boolean;
    copyable?: boolean;
  }>(),
  { size: 'md', orientation: 'horizontal', showProgress: true, copyable: true }
);

const settings = useSettingsStore();
const { rows, noMotion, error, period, counter, secondsLeft, progress, currentCode } = useTotpWheel(
  () => props.entry
);

const revealed = ref(false);
let revealTimer: number | undefined;

const isBlurred = computed(() => settings.settings.hideCodes && !revealed.value);
const canCopy = computed(() => props.copyable && Boolean(currentCode.value));
const urgent = computed(() => secondsLeft.value <= 3 && Boolean(currentCode.value));
const isLong = computed(() => currentCode.value.length > 6);
const activeIndex = computed(() => rows.value.findIndex((row) => row.counter === counter.value));

function positionOf(row: { counter: number }): string {
  const index = rows.value.findIndex((item) => item.counter === row.counter);
  const delta = index - activeIndex.value;

  if (delta === 0) return 'pos-center';
  if (delta === -1) return 'pos-left';
  if (delta === 1) return 'pos-right';
  return delta < 0 ? 'pos-hidden-left' : 'pos-hidden-right';
}

async function handleCopy(event: MouseEvent): Promise<void> {
  event.stopPropagation();
  if (!canCopy.value) return;

  const ok = await copyText(currentCode.value);
  if (!ok) {
    toast('复制失败，请手动选择验证码', 'error');
    return;
  }

  toast('验证码已复制', 'success');
  scheduleClipboardClear(settings.settings.clipboardClearSeconds);

  if (settings.settings.hideCodes) {
    revealed.value = true;
    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => {
      revealed.value = false;
    }, 4000);
  }
}

onUnmounted(() => window.clearTimeout(revealTimer));
</script>

<template>
  <button
    type="button"
    class="totp-code"
    :class="[`size-${size}`, { 'is-blurred': isBlurred, 'is-error': Boolean(error) }]"
    :title="error || (copyable ? '点击复制验证码' : undefined)"
    :disabled="!canCopy"
    :aria-label="`${entry.issuer || entry.name} 验证码，点击复制`"
    @click="handleCopy"
  >
    <span class="code-main">
      <span
        class="wheel"
        :class="[
          `wheel-${props.orientation}`,
          { 'no-motion': noMotion, 'is-urgent': urgent, 'is-long': isLong }
        ]"
        aria-hidden="true"
      >
        <span
          v-for="row in rows"
          :key="row.counter"
          class="wheel-item"
          :class="positionOf(row)"
        >
          {{ formatTotpCode(row.code) }}
        </span>
        <span v-if="!rows.length" class="wheel-item pos-center wheel-fallback">
          {{ error ? '— — —' : '• • •' }}
        </span>
      </span>

      <span v-if="copyable && currentCode" class="copy-hint"><AppIcon name="copy" :size="13" /></span>
    </span>

    <span v-if="showProgress && period !== 30" class="code-progress" aria-hidden="true">
      <span class="bar">
        <span class="bar-fill" :style="{ width: `${Math.max(progress, 0.02) * 100}%` }"></span>
      </span>
      <span class="seconds">{{ secondsLeft }}s</span>
    </span>

    <span class="sr-only">
      当前验证码 {{ currentCode || '未生成' }}，{{ secondsLeft }} 秒后刷新
    </span>
  </button>
</template>

<style scoped>
.totp-code {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  width: min(100%, 280px);
  padding: 2px 4px;
  margin: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.totp-code:not(:disabled):hover {
  background: var(--surface-2);
}

.totp-code:disabled {
  cursor: default;
}

/* 尺寸：轮盘高度 / 中间字号 / 两侧字号 */
.size-sm {
  --wheel-height: 30px;
  --wheel-current: 19px;
  --wheel-adjacent: 8px;
}

.size-md {
  --wheel-height: 38px;
  --wheel-current: 26px;
  --wheel-adjacent: 10px;
}

.size-lg {
  --wheel-height: 50px;
  --wheel-current: 34px;
  --wheel-adjacent: 12px;
}

.code-main {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.wheel {
  position: relative;
  display: block;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.wheel-horizontal {
  height: var(--wheel-height);
  mask-image: linear-gradient(90deg, transparent 0, #000 5%, #000 95%, transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 5%, #000 95%, transparent 100%);
}

.wheel-vertical {
  height: calc(var(--wheel-row, 22px) * 3);
  mask-image: linear-gradient(180deg, transparent 0, #000 8%, #000 92%, transparent 100%);
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 8%, #000 92%, transparent 100%);
}

.wheel-item {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-mono);
  font-size: var(--wheel-adjacent);
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.02em;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  opacity: 0.45;
  filter: grayscale(1);
  transition:
    left 0.34s cubic-bezier(0.22, 0.61, 0.36, 1),
    font-size 0.34s ease,
    opacity 0.34s ease,
    color 0.34s ease;
  will-change: left, font-size, opacity;
}

.wheel-fallback {
  letter-spacing: 0.12em;
}

.wheel-horizontal .pos-center {
  left: 50%;
  z-index: 2;
  font-size: var(--wheel-current);
  font-weight: 650;
  letter-spacing: 0.08em;
  color: var(--text);
  opacity: 1;
  filter: none;
}

.wheel-horizontal .pos-left {
  left: 9%;
}

.wheel-horizontal .pos-right {
  left: 91%;
}

.wheel-horizontal .pos-hidden-left {
  left: -12%;
  opacity: 0;
}

.wheel-horizontal .pos-hidden-right {
  left: 112%;
  opacity: 0;
}

/* 上中下：窄卡片使用，三条码都完整可读 */
.wheel-vertical .pos-center {
  left: 50%;
  top: 50%;
  z-index: 2;
  font-size: var(--wheel-current);
  font-weight: 650;
  letter-spacing: 0.06em;
  color: var(--text);
  opacity: 1;
  filter: none;
}

.wheel-vertical .pos-left {
  left: 50%;
  top: 16.67%;
}

.wheel-vertical .pos-right {
  left: 50%;
  top: 83.33%;
}

.wheel-vertical .pos-hidden-left {
  left: 50%;
  top: -16%;
  opacity: 0;
}

.wheel-vertical .pos-hidden-right {
  left: 50%;
  top: 116%;
  opacity: 0;
}

.size-sm {
  --wheel-row: 20px;
}

.wheel-vertical .pos-left,
.wheel-vertical .pos-right {
  font-size: var(--wheel-adjacent);
}

/* 8 位验证码稍缩小，避免与两侧文字重叠 */
.is-long .pos-center {
  font-size: calc(var(--wheel-current) * 0.84);
  letter-spacing: 0.04em;
}

.size-sm.is-long .pos-center {
  font-size: calc(var(--wheel-current) * 0.76);
}

.wheel.no-motion .wheel-item {
  transition: none !important;
}

/* 剩余 3 秒以内：淡红闪烁 */
.wheel.is-urgent .pos-center {
  color: color-mix(in srgb, var(--danger) 72%, #ffffff);
  animation: code-flash 0.85s ease-in-out infinite;
}

@keyframes code-flash {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.32;
  }
}

.is-blurred .wheel {
  filter: blur(7px);
  user-select: none;
}

.is-blurred:hover .wheel,
.is-blurred:focus-visible .wheel {
  filter: blur(2px);
}

.is-error .pos-center {
  color: var(--danger);
  letter-spacing: 0.06em;
}

.copy-hint {
  flex: none;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.totp-code:hover .copy-hint,
.totp-code:focus-visible .copy-hint {
  opacity: 1;
}

.code-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 4px;
}

.bar {
  position: relative;
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--progress-track);
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--primary), var(--primary-soft));
  transition: width 0.45s linear;
}

.seconds {
  min-width: 26px;
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
