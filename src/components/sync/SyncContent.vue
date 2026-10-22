<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import ModalShell from '@/components/ModalShell.vue';
import FormField from '@/components/common/FormField.vue';
import { useDevice } from '@/composables/useDevice';
import { useSyncStore } from '@/stores/syncStore';
import type { SyncProvider } from '@/types/sync';
import { copyText } from '@/utils/clipboard';
import { confirmDialog, toast } from '@/utils/feedback';
import { formatDateTime, formatRelativeTime } from '@/utils/format';
import { createRandomSecret } from '@/utils/id';

const sync = useSyncStore();
const { isMobile } = useDevice();

const providerOptions: Array<{ value: SyncProvider; label: string; hint: string; icon: 'github' | 'gitlab' }> = [
  { value: 'github', label: 'GitHub Gist', hint: 'PAT 需要 gist 权限', icon: 'github' },
  { value: 'gitlab', label: 'GitLab Snippet', hint: 'PAT 需要 api 权限', icon: 'gitlab' }
];

const basePlaceholder = computed(() =>
  sync.config.provider === 'github'
    ? '留空使用 https://api.github.com'
    : '留空使用 https://gitlab.com/api/v4'
);

// 进入同步页时自动验证一次 PAT 的认证状态
onMounted(() => {
  if (!sync.config.pat.trim() || sync.busy) return;
  sync.testConnection().catch(() => undefined);
});

const providerLabels: Record<SyncProvider, string> = {
  github: 'GitHub Gist',
  gitlab: 'GitLab Snippet'
};
const lockedProviderLabel = computed(() => providerLabels[sync.config.provider]);

type KeyDialogMode = 'pull' | 'push' | 'push-create';

const keyDialog = reactive<{ open: boolean; mode: KeyDialogMode; force: boolean }>({
  open: false,
  mode: 'pull',
  force: false
});
const keyInput = ref('');
const keyVisible = ref(false);
const keyError = ref('');
const keySubmitting = ref(false);

const keyDialogTitle = computed(
  () =>
    ({
      pull: '输入解密密钥',
      push: '校验加密密钥',
      'push-create': '设置加密密钥'
    })[keyDialog.mode]
);
const keyDialogSubtitle = computed(
  () =>
    ({
      pull: '将用该密钥解密远端最新数据；解密失败不会覆盖本地数据',
      push: '先解密远端最新数据验证密钥，一致后再用该密钥加密本地数据并推送',
      'push-create': '首次推送会创建私有远端；密钥只保存在内存中，请妥善保存'
    })[keyDialog.mode]
);
const keyDialogSubmitText = computed(
  () =>
    ({
      pull: '解密并拉取',
      push: '校验并推送',
      'push-create': '创建并推送'
    })[keyDialog.mode]
);

function setProvider(provider: SyncProvider): void {
  if (provider === sync.config.provider) return;
  if (!sync.setProvider(provider)) {
    toast('已绑定远端，请先解除关联再切换同步平台', 'warning');
  }
}

function openKeyDialog(mode: KeyDialogMode, force = false): void {
  keyDialog.mode = mode;
  keyDialog.force = force;
  keyInput.value = '';
  keyVisible.value = false;
  keyError.value = '';
  keySubmitting.value = false;
  keyDialog.open = true;
}

function closeKeyDialog(): void {
  if (keySubmitting.value) return;
  keyDialog.open = false;
}

function generateKey(): void {
  keyInput.value = createRandomSecret(32);
  keyVisible.value = true;
  toast('已生成随机密钥，请立即复制并妥善保存', 'success');
}

async function copyKey(): Promise<void> {
  const value = keyInput.value.trim();
  if (!value) {
    toast('请先生成或填写加密密钥', 'warning');
    return;
  }
  const ok = await copyText(value);
  toast(ok ? '密钥已复制' : '复制失败，请手动选择', ok ? 'success' : 'error');
}

async function submitKey(): Promise<void> {
  const key = keyInput.value.trim();
  if (key.length < 8) {
    keyError.value = '加密密钥至少需要 8 位字符';
    return;
  }

  keySubmitting.value = true;
  keyError.value = '';

  try {
    if (keyDialog.mode === 'pull') {
      const count = await sync.pull(key);
      keyDialog.open = false;
      toast(`已拉取 ${count} 条记录`, 'success');
      return;
    }

    const created = keyDialog.mode === 'push-create';
    await sync.push(keyDialog.force, key);
    keyDialog.open = false;
    toast(created ? '已创建远端并推送' : '已推送到远端', 'success');
  } catch (error) {
    keyError.value = error instanceof Error ? error.message : '操作失败';
  } finally {
    keySubmitting.value = false;
  }
}

async function handleTest(): Promise<void> {
  try {
    await sync.testConnection();
    toast(sync.statusMessage || '连接成功', 'success');
  } catch (error) {
    toast(error instanceof Error ? error.message : '连接失败', 'error');
  }
}

async function handleCheck(): Promise<void> {
  await sync.checkRemote();
  if (sync.errorMessage) toast(sync.errorMessage, 'error');
  else toast(sync.statusMessage || '已检查远端状态', 'success');
}

function handlePull(): void {
  if (!sync.config.gistId) {
    toast('请先推送一次以创建远端', 'warning');
    return;
  }
  openKeyDialog('pull');
}

async function handlePush(): Promise<void> {
  if (!sync.config.pat.trim()) {
    toast('请先填写 Personal Access Token', 'warning');
    return;
  }

  if (!sync.config.gistId) {
    openKeyDialog('push-create');
    return;
  }

  let force = false;
  if (sync.remoteVersion > sync.localVersion) {
    const confirmed = await confirmDialog({
      title: '覆盖远端数据',
      message: '远端存在更新的版本，继续推送会用本地数据覆盖远端。确定继续吗？',
      confirmText: '强制推送',
      danger: true
    });
    if (!confirmed) return;
    force = true;
  }

  openKeyDialog('push', force);
}

async function handleReset(): Promise<void> {
  const confirmed = await confirmDialog({
    title: '解除远端关联',
    message: '仅清除本地保存的远端 ID 与版本信息，不会删除远端数据。确定继续吗？',
    confirmText: '解除',
    danger: true
  });
  if (!confirmed) return;

  sync.resetConnection();
  toast('已解除与远端的关联', 'success');
}
</script>

<template>
  <div class="sync-content">
    <section class="card status-card">
      <div class="status-top">
        <div class="status-main">
          <span class="status-emblem" :class="`tone-${sync.stateTone}`">
            <AppIcon name="sync" :size="18" />
          </span>
          <div>
            <strong>{{ sync.stateLabel }}</strong>
            <p>{{ sync.stateDescription }}</p>
          </div>
        </div>
        <button type="button" class="btn ghost small" :disabled="sync.busy" @click="handleCheck">
          <AppIcon name="search" :size="14" />
          检查远端
        </button>
      </div>

      <dl class="status-grid">
        <div>
          <dt>本地版本</dt>
          <dd>v{{ sync.localVersion }}</dd>
        </div>
        <div>
          <dt>远端版本</dt>
          <dd>{{ sync.hasRemote ? `v${sync.remoteVersion}` : '—' }}</dd>
        </div>
        <div>
          <dt>最后同步</dt>
          <dd :title="formatDateTime(sync.lastSyncTime)">{{ formatRelativeTime(sync.lastSyncTime) }}</dd>
        </div>
        <div>
          <dt>认证账号</dt>
          <dd>{{ sync.account || '未验证' }}</dd>
        </div>
      </dl>

      <p v-if="sync.errorMessage" class="alert error">
        <AppIcon name="warning" :size="15" />
        <span>{{ sync.errorMessage }}</span>
      </p>
      <p v-else-if="sync.verifying" class="alert info">
        <AppIcon name="clock" :size="15" />
        <span>正在验证认证状态…</span>
      </p>
      <p v-else-if="sync.statusMessage" class="alert success">
        <AppIcon name="check" :size="15" />
        <span>{{ sync.statusMessage }}</span>
      </p>
    </section>

    <section class="card config-card">
      <header class="card-head">
        <h2>连接配置</h2>
        <span class="muted">
          {{ sync.providerLocked ? '已绑定远端，解绑前不可修改连接配置' : '配置仅保存在本机 localStorage' }}
        </span>
      </header>

      <div class="field-block">
        <span class="field-label">同步平台</span>
        <div class="provider-grid">
          <button
            v-for="option in providerOptions"
            :key="option.value"
            type="button"
            class="provider-option"
            :class="{ active: sync.config.provider === option.value }"
            :disabled="sync.providerLocked && sync.config.provider !== option.value"
            :title="
              sync.providerLocked && sync.config.provider !== option.value
                ? '已绑定远端，请先解除关联再切换平台'
                : undefined
            "
            @click="setProvider(option.value)"
          >
            <AppIcon :name="option.icon" :size="22" />
            <span class="provider-name">{{ option.label }}</span>
            <span class="provider-hint">{{ option.hint }}</span>
          </button>
        </div>

        <p v-if="sync.providerLocked" class="provider-lock">
          <AppIcon name="lock" :size="13" />
          <span>已绑定 {{ lockedProviderLabel }}，切换平台前需先解除关联</span>
          <button type="button" class="link-button provider-unlock" @click="handleReset">
            解除关联
          </button>
        </p>
      </div>

      <div class="field-grid">
        <FormField
          v-model="sync.config.baseUrl"
          label="API 地址（可选）"
          :placeholder="basePlaceholder"
          :disabled="sync.providerLocked"
          hint="支持私有化部署，留空使用官方地址"
        />
        <FormField
          v-model="sync.config.pat"
          label="Personal Access Token"
          type="password"
          placeholder="ghp_... 或 glpat-..."
          autocomplete="off"
          :disabled="sync.providerLocked"
          hint="仅保存在本机；GitHub 需要 gist 权限，GitLab 需要 api 权限"
        />
      </div>

      <FormField
        v-model="sync.config.gistId"
        label="Gist / Snippet ID（可选）"
        placeholder="留空时首次推送会自动创建"
        :disabled="sync.providerLocked"
        :hint="
          sync.providerLocked
            ? '已绑定远端，解绑后才能修改'
            : '首次推送后自动回填；也可手动填写已有远端 ID'
        "
      />

      <div class="switch-rows">
        <div class="switch-row">
          <div>
            <strong>启用同步</strong>
            <p>启动时自动检查远端更新</p>
          </div>
          <el-switch v-if="!isMobile" v-model="sync.config.enabled" />
          <van-switch v-else v-model="sync.config.enabled" size="22" />
        </div>
        <div class="switch-row">
          <div>
            <strong>自动推送</strong>
            <p>本地数据变化后自动加密推送（需要密钥在内存中）</p>
          </div>
          <el-switch v-if="!isMobile" v-model="sync.autoPush" />
          <van-switch v-else v-model="sync.autoPush" size="22" />
        </div>
      </div>

      <div class="sync-actions">
        <button type="button" class="btn ghost" :disabled="sync.busy" @click="handleTest">
          <AppIcon name="link" :size="15" />
          测试连接
        </button>
        <button type="button" class="btn ghost" :disabled="sync.busy" @click="handleCheck">
          <AppIcon name="sync" :size="15" />
          检查远端
        </button>
        <button
          type="button"
          class="btn ghost"
          :disabled="sync.busy || !sync.hasRemote"
          @click="handlePull"
        >
          <AppIcon name="download" :size="15" />
          拉取覆盖本地
        </button>
        <button
          type="button"
          class="btn primary"
          :disabled="sync.busy || !sync.config.pat"
          @click="handlePush"
        >
          <AppIcon name="upload" :size="15" />
          {{ sync.busy ? '处理中…' : '推送到远端' }}
        </button>
      </div>
    </section>

    <ModalShell
      v-if="keyDialog.open"
      :title="keyDialogTitle"
      :subtitle="keyDialogSubtitle"
      size="md"
      :close-on-backdrop="false"
      @close="closeKeyDialog"
    >
      <div class="key-dialog">
        <label class="key-field-label" for="sync-key">加密密钥</label>
        <div class="key-input-row">
          <input
            id="sync-key"
            v-model="keyInput"
            class="key-input"
            :type="keyVisible ? 'text' : 'password'"
            placeholder="至少 8 位字符"
            autocomplete="off"
            spellcheck="false"
            @keyup.enter="submitKey"
          />
          <button
            type="button"
            class="icon-btn"
            :aria-label="keyVisible ? '隐藏密钥' : '显示密钥'"
            @click="keyVisible = !keyVisible"
          >
            <AppIcon :name="keyVisible ? 'eyeOff' : 'eye'" :size="16" />
          </button>
        </div>

        <div v-if="keyDialog.mode === 'push-create'" class="key-actions">
          <button type="button" class="btn ghost small" @click="generateKey">
            <AppIcon name="key" :size="14" />
            生成随机密钥
          </button>
          <button type="button" class="btn ghost small" @click="copyKey">
            <AppIcon name="copy" :size="14" />
            复制密钥
          </button>
        </div>

        <p class="key-hint">
          {{
            keyDialog.mode === 'pull'
              ? '密钥仅保存在本次会话内存中，用于解密远端数据。'
              : '密钥仅保存在本次会话内存中，不会上传或写入本地存储。'
          }}
        </p>

        <p v-if="keyError" class="key-error">{{ keyError }}</p>
      </div>

      <template #footer>
        <button type="button" class="btn ghost" :disabled="keySubmitting" @click="closeKeyDialog">
          取消
        </button>
        <button
          type="button"
          class="btn primary"
          :disabled="keySubmitting || !keyInput.trim()"
          @click="submitKey"
        >
          {{ keySubmitting ? '处理中…' : keyDialogSubmitText }}
        </button>
      </template>
    </ModalShell>
  </div>
</template>

<style scoped>
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.tone-info {
  color: var(--text-secondary);
  background: var(--surface-2);
  border-color: var(--border);
}

.tone-success {
  color: var(--success);
  background: var(--success-ghost);
  border-color: color-mix(in srgb, var(--success) 30%, transparent);
}

.tone-warning {
  color: var(--warning);
  background: var(--warning-ghost);
  border-color: color-mix(in srgb, var(--warning) 32%, transparent);
}

.tone-danger {
  color: var(--danger);
  background: var(--danger-ghost);
  border-color: color-mix(in srgb, var(--danger) 30%, transparent);
}

.status-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
}

.status-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.status-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-emblem {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--text-secondary);
}

.status-emblem.tone-success {
  background: var(--success-ghost);
  color: var(--success);
}

.status-emblem.tone-warning {
  background: var(--warning-ghost);
  color: var(--warning);
}

.status-emblem.tone-danger {
  background: var(--danger-ghost);
  color: var(--danger);
}

.status-main strong {
  font-size: 14px;
}

.status-main p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.status-grid div {
  padding: 8px 11px;
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.status-grid dt {
  font-size: 10.5px;
  color: var(--text-muted);
}

.status-grid dd {
  margin: 3px 0 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}

.alert {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: 12.5px;
  line-height: 1.5;
}

.alert.error {
  background: var(--danger-ghost);
  color: var(--danger);
}

.alert.success {
  background: var(--success-ghost);
  color: var(--success);
}

.alert.info {
  background: var(--surface-2);
  color: var(--text-secondary);
}

.config-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.card-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.muted {
  font-size: 11.5px;
  color: var(--text-muted);
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.provider-option {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  gap: 1px 9px;
  align-items: center;
  padding: 10px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.provider-option > :first-child {
  grid-row: span 2;
  color: var(--text-muted);
}

.provider-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.provider-option:disabled:hover {
  border-color: var(--border);
}

.provider-lock {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-muted);
}

.provider-unlock {
  font-size: 11.5px;
}

.provider-option.active {
  border-color: var(--primary);
  background: var(--primary-ghost);
  color: var(--primary-strong);
}

.provider-option.active > :first-child {
  color: var(--primary);
}

.provider-name {
  font-size: 13px;
  font-weight: 600;
}

.provider-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.provider-option.active .provider-hint {
  color: var(--primary-strong);
  opacity: 0.8;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.key-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.switch-rows {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.switch-row strong {
  display: block;
  font-size: 13px;
  color: var(--text);
}

.switch-row p {
  margin: 3px 0 0;
  font-size: 11px;
  color: var(--text-muted);
}

.sync-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.sync-actions .btn.primary {
  margin-left: auto;
}

.link-button {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--danger);
  font-size: 12px;
  cursor: pointer;
}

.key-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.key-field-label {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
}

.key-input-row {
  position: relative;
  display: flex;
  align-items: center;
}

.key-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.03em;
  outline: none;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.key-input:focus {
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--primary-ghost);
}

.key-input-row .icon-btn {
  position: absolute;
  right: 4px;
}

.key-hint {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-muted);
}

.key-error {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--danger-ghost);
  color: var(--danger);
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .field-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .status-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .config-card,
  .status-card {
    padding: 16px;
  }

  .status-pill {
    align-self: flex-start;
  }

  .provider-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .switch-rows {
    grid-template-columns: minmax(0, 1fr);
  }

  .sync-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sync-actions .btn {
    justify-content: center;
  }

  .sync-actions .btn.primary {
    margin-left: 0;
    grid-column: span 2;
  }

  .status-top {
    flex-direction: column;
  }
}
</style>
