import { computed, ref } from 'vue';

import { BREAKPOINT } from '@/constants';

const viewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth);
let listening = false;

function ensureListener(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;

  const update = (): void => {
    viewportWidth.value = window.innerWidth;
  };

  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('orientationchange', update);
}

/** 根据视口宽度切换移动端 / 桌面端 UI */
export function useDevice() {
  ensureListener();

  const isMobile = computed(() => viewportWidth.value < BREAKPOINT);
  const isDesktop = computed(() => !isMobile.value);

  return { viewportWidth, isMobile, isDesktop };
}
