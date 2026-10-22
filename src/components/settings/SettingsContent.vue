<script setup lang="ts">
import { ref } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import { useDevice } from '@/composables/useDevice';
import { APP_VERSION } from '@/constants';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useTotpStore } from '@/stores/totpStore';
import { CLIPBOARD_CLEAR_OPTIONS } from '@/types/settings';
import type { ThemeMode } from '@/types/settings';
import { createBackup, downloadJson, parseBackup } from '@/utils/backup';
import { confirmDialog, toast } from '@/utils/feedback';

const settings = useSettingsStore();
const sync = useSyncStore();
const totp = useTotpStore();
const { isMobile } = useDevice();

const importMode = ref<'merge' | 'replace'>('merge');
const importing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const themeOptions: Array<{ value: ThemeMode; label: string; icon: 'auto' | 'sun' | 'moon' }> = [
  { value: 'auto', label: '跟随系统', icon: 'auto' },
  { value: 'light', label: '浅色', icon: 'sun' },
  { value: 'dark', label: '深色', icon: 'moon' }
];

function pickTheme(theme: ThemeMode): void {
  settings.setTheme(theme);
}

function pickClipboard(seconds: number): void {
  settings.setClipboardClearSeconds(seconds);
}

function handleExport(): void {
  if (!totp.entries.length) {
    toast('还没有可导出的验证码', 'warning');
    return;
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  downloadJson(`dtop-backup-${stamp}.json`, createBackup(totp.exportData()));
  toast('备份已导出，请妥善保管', 'success');
}

function triggerImport(): void {
  fileInput.value?.click();
}

async function handleFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    toast('文件过大（上限 5MB）', 'error');
    return;
  }

  importing.value = true;
  try {
    const entries = parseBackup(await file.text());
    if (!entries.length) {
      toast('文件中没有可导入的数据', 'warning');
      return;
    }

    const modeLabel = importMode.value === 'replace' ? '覆盖现有数据' : '合并到现有数据';
    const confirmed = await confirmDialog({
      title: '导入备份',
      message: `将导入 ${entries.length} 条记录并${modeLabel}，是否继续？`,
      confirmText: '导入'
    });
    if (!confirmed) return;

    const count = await totp.importEntries(entries, importMode.value);
    toast(`已导入 ${count} 条记录`, 'success');
  } catch (error) {
    toast(error instanceof Error ? error.message : '导入失败', 'error');
  } finally {
    importing.value = false;
  }
}

async function handleClearAll(): Promise<void> {
  if (!totp.entries.length) {
    toast('当前没有数据', 'info');
    return;
  }

  const confirmed = await confirmDialog({
    title: '清空全部数据',
    message: `将删除本机全部 ${totp.entries.length} 条验证码，且无法恢复。建议先导出备份。`,
    confirmText: '清空',
    danger: true
  });
  if (!confirmed) return;

  await totp.clearAll();
  toast('已清空本地数据', 'success');
}
</script>

<template>
  <div class="settings-content">
    <section class="card settings-section">
      <header class="section-head">
        <span class="section-icon"><AppIcon name="sun" :size="16" /></span>
        <div>
          <h2>外观</h2>
          <p>主题会同时应用到移动端与桌面端</p>
        </div>
      </header>

      <div class="setting-row">
        <div class="setting-copy">
          <strong>主题</strong>
          <p>默认跟随系统深浅色偏好</p>
        </div>
        <div class="segmented">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            type="button"
            :class="{ active: settings.settings.theme === option.value }"
            @click="pickTheme(option.value)"
          >
            <AppIcon :name="option.icon" :size="14" />
            <span>{{ option.label }}</span>
          </button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-copy">
          <strong>移动端列表</strong>
          <p>手机上一行显示 1 条或 2 条验证码</p>
        </div>
        <div class="segmented">
          <button
            type="button"
            :class="{ active: settings.settings.mobileColumns === 1 }"
            @click="settings.setMobileColumns(1)"
          >
            1 条
          </button>
          <button
            type="button"
            :class="{ active: settings.settings.mobileColumns === 2 }"
            @click="settings.setMobileColumns(2)"
          >
            2 条
          </button>
        </div>
      </div>
    </section>

    <section class="card settings-section">
      <header class="section-head">
        <span class="section-icon"><AppIcon name="shield" :size="16" /></span>
        <div>
          <h2>显示与安全</h2>
          <p>降低验证码被旁观或剪贴板残留的风险</p>
        </div>
      </header>

      <div class="setting-row">
        <div class="setting-copy">
          <strong>隐藏验证码</strong>
          <p>列表默认模糊显示，悬停或点击后临时显示</p>
        </div>
        <el-switch v-if="!isMobile" v-model="settings.settings.hideCodes" />
        <van-switch v-else v-model="settings.settings.hideCodes" size="22" />
      </div>

      <div class="setting-row">
        <div class="setting-copy">
          <strong>复制后清空剪贴板</strong>
          <p>复制验证码后定时清空系统剪贴板</p>
        </div>
        <div class="segmented">
          <button
            v-for="seconds in CLIPBOARD_CLEAR_OPTIONS"
            :key="seconds"
            type="button"
            :class="{ active: settings.settings.clipboardClearSeconds === seconds }"
            @click="pickClipboard(seconds)"
          >
            {{ seconds === 0 ? '关闭' : `${seconds}s` }}
          </button>
        </div>
      </div>
    </section>

    <section class="card settings-section span-2">
      <header class="section-head">
        <span class="section-icon"><AppIcon name="folder" :size="16" /></span>
        <div>
          <h2>数据管理</h2>
          <p>备份文件包含明文密钥，请存放在安全位置</p>
        </div>
      </header>

      <div class="setting-row">
        <div class="setting-copy">
          <strong>导出备份</strong>
          <p>导出全部条目为 JSON 文件</p>
        </div>
        <button type="button" class="btn ghost" @click="handleExport">
          <AppIcon name="download" :size="15" />
          导出
        </button>
      </div>

      <div class="setting-row">
        <div class="setting-copy">
          <strong>导入备份</strong>
          <p>支持 dtop 备份文件或条目数组</p>
        </div>
        <div class="row-controls">
          <div class="segmented compact">
            <button
              type="button"
              :class="{ active: importMode === 'merge' }"
              @click="importMode = 'merge'"
            >
              合并
            </button>
            <button
              type="button"
              :class="{ active: importMode === 'replace' }"
              @click="importMode = 'replace'"
            >
              覆盖
            </button>
          </div>
          <button type="button" class="btn ghost" :disabled="importing" @click="triggerImport">
            <AppIcon name="upload" :size="15" />
            {{ importing ? '导入中…' : '导入' }}
          </button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-copy">
          <strong>清空全部数据</strong>
          <p>删除本机所有验证码，操作不可撤销</p>
        </div>
        <button type="button" class="btn danger" @click="handleClearAll">
          <AppIcon name="trash" :size="15" />
          清空
        </button>
      </div>
    </section>

    <section class="card settings-section">
      <header class="section-head">
        <span class="section-icon"><AppIcon name="sync" :size="16" /></span>
        <div>
          <h2>同步</h2>
          <p>{{ sync.stateLabel }} · {{ sync.stateDescription }}</p>
        </div>
      </header>

      <div class="setting-row">
        <div class="setting-copy">
          <strong>GitHub / GitLab 加密同步</strong>
          <p>通过 Gist 或 Snippet 在多设备间同步，数据端到端加密</p>
        </div>
        <RouterLink to="/sync" class="btn ghost">
          <AppIcon name="sync" :size="15" />
          去配置
        </RouterLink>
      </div>
    </section>

    <section class="card settings-section about-section">
      <header class="section-head">
        <span class="section-icon"><AppIcon name="info" :size="16" /></span>
        <div>
          <h2>关于</h2>
          <p>纯静态、本地优先的 TOTP 验证器</p>
        </div>
      </header>

      <div class="about-grid">
        <div>
          <span>版本</span>
          <strong>v{{ APP_VERSION }}</strong>
        </div>
        <div>
          <span>本地条目</span>
          <strong>{{ totp.entries.length }}</strong>
        </div>
        <div>
          <span>存储方式</span>
          <strong>IndexedDB</strong>
        </div>
      </div>

      <p class="about-note">
        应用不依赖服务器，验证码由浏览器 Web Crypto 本地计算。同步仅上传 AES-GCM 加密后的数据，加密密钥不会离开本机。
      </p>
    </section>

    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      hidden
      @change="handleFileChange"
    />
  </div>
</template>

<style scoped>
.settings-content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}

.settings-section {
  padding: 16px 18px;
}

.settings-section.span-2 {
  grid-column: span 2;
}

.section-head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 2px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.section-icon {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  flex: none;
  border-radius: 8px;
  background: var(--primary-ghost);
  color: var(--primary);
}

.section-head h2 {
  margin: 1px 0 0;
  font-size: 13.5px;
  font-weight: 600;
}

.section-head p {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--text-muted);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px dashed var(--border);
}

.setting-row:last-child {
  border-bottom: 0;
  padding-bottom: 2px;
}

.setting-copy strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.setting-copy p {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--text-muted);
}

.row-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 0 10px;
}

.about-grid div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 11px;
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.about-grid span {
  font-size: 10.5px;
  color: var(--text-muted);
}

.about-grid strong {
  font-size: 13px;
  color: var(--text);
  font-weight: 600;
}

.about-note {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-muted);
}

@media (max-width: 1023px) {
  .settings-content {
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-section.span-2 {
    grid-column: auto;
  }
}

@media (max-width: 767px) {
  .settings-section {
    padding: 14px 15px;
  }

  .setting-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
  }

  .setting-row > :last-child {
    align-self: flex-start;
  }

  .about-grid {
    gap: 6px;
  }

  .about-grid div {
    padding: 8px 9px;
  }
}
</style>
