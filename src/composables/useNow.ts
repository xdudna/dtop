import { onMounted, onUnmounted, ref } from 'vue';

const now = ref(Date.now());
let timer: number | null = null;
let subscribers = 0;
const INTERVAL = 500;

function start(): void {
  if (timer !== null) return;
  timer = window.setInterval(() => {
    now.value = Date.now();
  }, INTERVAL);
}

function stop(): void {
  if (timer === null) return;
  window.clearInterval(timer);
  timer = null;
}

/** 全局共享时钟：多个验证码组件共用一个定时器 */
export function useNow() {
  onMounted(() => {
    subscribers += 1;
    now.value = Date.now();
    start();
  });

  onUnmounted(() => {
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers === 0) stop();
  });

  return now;
}
