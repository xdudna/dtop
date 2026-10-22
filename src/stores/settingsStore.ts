import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';

import { STORAGE_KEYS } from '@/constants';
import { DEFAULT_SETTINGS } from '@/types/settings';
import type { AppSettings, ThemeMode } from '@/types/settings';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'auto' ? parsed.theme : DEFAULT_SETTINGS.theme,
      hideCodes: Boolean(parsed.hideCodes),
      clipboardClearSeconds: Number.isFinite(Number(parsed.clipboardClearSeconds))
        ? Math.max(0, Number(parsed.clipboardClearSeconds))
        : DEFAULT_SETTINGS.clipboardClearSeconds,
      desktopView: parsed.desktopView === 'table' ? 'table' : 'cards',
      mobileColumns: parsed.mobileColumns === 1 ? 1 : 2,
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed)
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = reactive<AppSettings>(loadSettings());
  const systemDark = ref(false);
  const initialized = ref(false);
  let mediaQuery: MediaQueryList | null = null;

  const resolvedTheme = computed<'light' | 'dark'>(() =>
    settings.theme === 'auto' ? (systemDark.value ? 'dark' : 'light') : settings.theme
  );
  const isDark = computed(() => resolvedTheme.value === 'dark');
  const themeLabel = computed(() => {
    if (settings.theme === 'auto') return '跟随系统';
    return settings.theme === 'dark' ? '深色' : '浅色';
  });

  function applyTheme(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const dark = resolvedTheme.value === 'dark';

    root.dataset.theme = resolvedTheme.value;
    root.classList.toggle('dark', dark);
    root.classList.toggle('van-theme-dark', dark);

    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#0d1117' : '#f4f5f9');
  }

  function persist(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      // localStorage 不可用时静默失败，设置仍在当前会话生效
    }
  }

  function init(): void {
    if (initialized.value) return;
    initialized.value = true;

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemDark.value = mediaQuery.matches;
      mediaQuery.addEventListener('change', (event) => {
        systemDark.value = event.matches;
        applyTheme();
      });
    }

    watch(resolvedTheme, applyTheme, { immediate: true });
    watch(settings, persist, { deep: true });
  }

  function setTheme(theme: ThemeMode): void {
    settings.theme = theme;
  }

  function toggleTheme(): void {
    settings.theme = isDark.value ? 'light' : 'dark';
  }

  function setHideCodes(value: boolean): void {
    settings.hideCodes = value;
  }

  function setClipboardClearSeconds(value: number): void {
    settings.clipboardClearSeconds = Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function setDesktopView(view: AppSettings['desktopView']): void {
    settings.desktopView = view;
  }

  function setMobileColumns(columns: AppSettings['mobileColumns']): void {
    settings.mobileColumns = columns;
  }

  function toggleSidebar(): void {
    settings.sidebarCollapsed = !settings.sidebarCollapsed;
  }

  return {
    settings,
    resolvedTheme,
    isDark,
    themeLabel,
    init,
    setTheme,
    toggleTheme,
    setHideCodes,
    setClipboardClearSeconds,
    setDesktopView,
    setMobileColumns,
    toggleSidebar
  };
});
