<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import AppIcon from '@/components/AppIcon.vue';
import { APP_VERSION } from '@/constants';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';

const route = useRoute();
const settings = useSettingsStore();
const sync = useSyncStore();

const collapsed = computed(() => settings.settings.sidebarCollapsed);
const themeIcon = computed(() => (settings.isDark ? 'sun' : 'moon'));
const syncAttention = computed(() => sync.state === 'remote-ahead' || sync.state === 'conflict');
const collapseLabel = computed(() => (collapsed.value ? '展开侧边栏' : '收起侧边栏'));
</script>

<template>
  <div class="desktop-shell">
    <aside class="sidebar" :class="{ collapsed }">
      <div class="brand">
        <span class="brand-mark"><AppIcon name="shield" :size="22" /></span>
        <span v-show="!collapsed" class="brand-text">
          <strong>dtop</strong>
          <small>TOTP 验证器</small>
        </span>
      </div>

      <nav class="side-nav" aria-label="主导航">
        <RouterLink
          to="/"
          class="side-link"
          :class="{ active: route.path === '/' }"
          :title="collapsed ? '验证码' : undefined"
        >
          <AppIcon name="home" :size="18" />
          <span v-show="!collapsed">验证码</span>
        </RouterLink>

        <RouterLink
          to="/sync"
          class="side-link"
          :class="{ active: route.path.startsWith('/sync') }"
          :title="collapsed ? '同步' : undefined"
        >
          <AppIcon name="sync" :size="18" />
          <span v-show="!collapsed">同步</span>
          <span v-if="syncAttention" class="nav-dot" aria-label="同步需要处理"></span>
        </RouterLink>

        <RouterLink
          to="/settings"
          class="side-link"
          :class="{ active: route.path.startsWith('/settings') }"
          :title="collapsed ? '设置' : undefined"
        >
          <AppIcon name="settings" :size="18" />
          <span v-show="!collapsed">设置</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <button type="button" class="theme-button" :title="settings.themeLabel" @click="settings.toggleTheme()">
          <AppIcon :name="themeIcon" :size="16" />
          <span v-show="!collapsed">{{ settings.themeLabel }}</span>
        </button>

        <button type="button" class="theme-button" :title="collapseLabel" @click="settings.toggleSidebar()">
          <AppIcon :name="collapsed ? 'chevronRight' : 'chevronLeft'" :size="16" />
          <span v-show="!collapsed">收起侧边栏</span>
        </button>

        <p v-show="!collapsed" class="version">v{{ APP_VERSION }} · 数据仅存本机</p>
      </div>
    </aside>

    <main class="desktop-main">
      <div class="desktop-content">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>
    </main>
  </div>
</template>

<style scoped>
.desktop-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg);
}

.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 232px;
  flex: none;
  height: 100vh;
  padding: 22px 16px 18px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  transition:
    width 0.2s ease,
    padding 0.2s ease;
}

.sidebar.collapsed {
  width: 76px;
  padding: 22px 10px 18px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
}

.sidebar.collapsed .brand {
  justify-content: center;
  padding: 0;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  color: #fff;
  box-shadow: 0 6px 16px var(--primary-shadow);
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  white-space: nowrap;
}

.brand-text strong {
  font-size: 18px;
  letter-spacing: 0.02em;
  color: var(--text);
}

.brand-text small {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
}

.side-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.side-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}

.side-link:hover {
  background: var(--surface-2);
  color: var(--text);
}

.side-link.active {
  background: var(--primary-ghost);
  color: var(--primary-strong);
}

.sidebar.collapsed .side-link {
  justify-content: center;
  padding: 10px 0;
}

.sidebar.collapsed .nav-dot {
  position: absolute;
  top: 7px;
  right: 14px;
  margin-left: 0;
}

.nav-dot {
  width: 7px;
  height: 7px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 0 3px var(--warning-ghost);
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
  padding: 0 2px;
}

.theme-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    color 0.16s ease;
}

.theme-button:hover {
  border-color: var(--primary);
  color: var(--primary-strong);
}

.sidebar.collapsed .theme-button {
  justify-content: center;
  padding: 9px 0;
}

.version {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.desktop-main {
  flex: 1;
  min-width: 0;
  height: 100vh;
  overflow-y: auto;
}

.desktop-content {
  width: 100%;
  padding: 32px 36px 48px;
}

@media (max-width: 1100px) {
  .desktop-content {
    padding: 28px 28px 40px;
  }
}
</style>
