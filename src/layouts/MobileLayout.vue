<script setup lang="ts">
import { computed } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import { useSettingsStore } from '@/stores/settingsStore';

const settings = useSettingsStore();
const themeIcon = computed(() => (settings.isDark ? 'sun' : 'moon'));
</script>

<template>
  <div class="mobile-shell">
    <header class="mobile-topbar">
      <div class="brand">
        <span class="brand-mark"><AppIcon name="shield" :size="17" /></span>
        <strong>dtop</strong>
      </div>
      <button type="button" class="theme-button" :aria-label="`主题：${settings.themeLabel}`" @click="settings.toggleTheme()">
        <AppIcon :name="themeIcon" :size="17" />
      </button>
    </header>

    <main class="mobile-main">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <van-tabbar
      route
      fixed
      placeholder
      safe-area-inset-bottom
      active-color="var(--primary)"
      inactive-color="var(--text-muted)"
      class="mobile-tabbar"
    >
      <van-tabbar-item replace to="/">
        <span>验证码</span>
        <template #icon><AppIcon name="home" :size="20" /></template>
      </van-tabbar-item>
      <van-tabbar-item replace to="/sync">
        <span>同步</span>
        <template #icon><AppIcon name="sync" :size="20" /></template>
      </van-tabbar-item>
      <van-tabbar-item replace to="/settings">
        <span>设置</span>
        <template #icon><AppIcon name="settings" :size="20" /></template>
      </van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style scoped>
.mobile-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
}

.mobile-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(10px + env(safe-area-inset-top)) 18px 10px;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--text);
  font-size: 16px;
  letter-spacing: 0.02em;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  color: #fff;
}

.theme-button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
}

.mobile-main {
  flex: 1;
  padding: 20px 16px calc(28px + env(safe-area-inset-bottom));
}

.mobile-tabbar {
  border-top: 1px solid var(--border);
  background: var(--surface);
}
</style>
