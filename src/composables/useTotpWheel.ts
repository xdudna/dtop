import { computed, nextTick, onUnmounted, ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { generateTotp, getRemainingSeconds } from '@/crypto/totp';
import type { TotpEntry } from '@/types/totp';
import { STEAM_PERIOD } from '@/types/totp';

import { useNow } from './useNow';

export interface WheelRow {
  counter: number;
  code: string;
}

/**
 * 轮盘式验证码：维护「上一个 / 当前 / 下一个」及其后续验证码，
 * 到时间窗口后整列向上滚动一格。
 */
export function useTotpWheel(source: MaybeRefOrGetter<TotpEntry | null | undefined>) {
  const now = useNow();
  const rows = ref<WheelRow[]>([]);
  /** 静止时只保留 3 行（上一条 / 当前 / 下一条），第 4 条在换码动画时临时加入 */
  const upcoming = ref<WheelRow | null>(null);
  const rolling = ref(false);
  const noMotion = ref(false);
  const error = ref('');
  const ready = ref(false);

  const period = computed(() => {
    const entry = toValue(source);
    if (!entry) return 30;
    return entry.advanced.type === 'STEAM' ? STEAM_PERIOD : Math.max(1, entry.advanced.period);
  });
  const counter = computed(() => Math.floor(now.value / 1000 / period.value));
  const secondsLeft = computed(() => getRemainingSeconds(period.value, now.value));
  const progress = computed(() => secondsLeft.value / period.value);

  const currentCode = computed(
    () => rows.value.find((row) => row.counter === counter.value)?.code ?? ''
  );

  let generation = 0;
  let loadedCounter = -1;
  let loadedFingerprint = '';
  let animationTimer: number | undefined;

  function fingerprintOf(entry: TotpEntry): string {
    return [
      entry.secret,
      entry.advanced.type,
      entry.advanced.algorithm,
      entry.advanced.period,
      entry.advanced.digits
    ].join('|');
  }

  async function codeFor(entry: TotpEntry, targetCounter: number): Promise<WheelRow> {
    const timestamp = targetCounter * period.value * 1000 + 500;
    const code = await generateTotp(entry.secret, entry.advanced, timestamp);
    return { counter: targetCounter, code };
  }

  /** 以 center 为中心，加载「上一条 / 当前 / 下一条」，并预取下一条的下一条 */
  async function load(center: number, entry: TotpEntry): Promise<void> {
    const token = ++generation;
    try {
      const list: WheelRow[] = [];
      for (let offset = -1; offset <= 1; offset += 1) {
        list.push(await codeFor(entry, center + offset));
      }
      const nextRow = await codeFor(entry, center + 2);
      if (token !== generation) return;

      window.clearTimeout(animationTimer);
      rolling.value = false;
      noMotion.value = false;
      rows.value = list;
      upcoming.value = nextRow;
      loadedCounter = center;
      loadedFingerprint = fingerprintOf(entry);
      ready.value = true;
      error.value = '';
    } catch (err) {
      if (token !== generation) return;
      rows.value = [];
      upcoming.value = null;
      error.value = err instanceof Error ? err.message : '验证码生成失败';
    }
  }

  /** 向上滚一格：临时加入第 4 行，滚动完成后丢弃第一行并预取下一条 */
  function roll(entry: TotpEntry): void {
    if (!upcoming.value) return;

    rows.value = [...rows.value, upcoming.value];
    upcoming.value = null;
    rolling.value = true;
    window.clearTimeout(animationTimer);

    animationTimer = window.setTimeout(async () => {
      noMotion.value = true;
      rolling.value = false;
      rows.value = rows.value.slice(1);

      await nextTick();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          noMotion.value = false;
        });
      });

      const last = rows.value[rows.value.length - 1]?.counter ?? loadedCounter + 1;
      try {
        upcoming.value = await codeFor(entry, last + 1);
      } catch {
        // 预取失败时下次换码会走整组重新加载
      }
    }, 380);
  }

  watch(
    [counter, () => toValue(source)],
    async ([current]) => {
      const entry = toValue(source);
      if (!entry || !entry.secret) {
        rows.value = [];
        ready.value = false;
        loadedCounter = -1;
        loadedFingerprint = '';
        return;
      }

      if (!ready.value || loadedCounter === -1 || fingerprintOf(entry) !== loadedFingerprint) {
        await load(current, entry);
        return;
      }

      if (current === loadedCounter) return;

      if (current === loadedCounter + 1 && upcoming.value) {
        loadedCounter = current;
        roll(entry);
        return;
      }

      await load(current, entry);
    },
    { immediate: true, deep: true }
  );

  onUnmounted(() => window.clearTimeout(animationTimer));

  return {
    rows,
    rolling,
    noMotion,
    ready,
    error,
    period,
    counter,
    secondsLeft,
    progress,
    currentCode
  };
}
