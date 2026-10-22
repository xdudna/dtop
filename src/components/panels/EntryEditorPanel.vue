<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import EntryFormDesktop from '@/components/desktop/EntryFormDesktop.vue';
import EntryFormMobile from '@/components/mobile/EntryFormMobile.vue';
import ModalShell from '@/components/ModalShell.vue';
import TotpCode from '@/components/TotpCode.vue';
import { useDevice } from '@/composables/useDevice';
import type { EntryFormField } from '@/composables/useEntryForm';
import { formFromEntry, useEntryForm } from '@/composables/useEntryForm';
import { useTotpStore } from '@/stores/totpStore';
import { DEFAULT_GROUP } from '@/types/totp';
import { confirmDialog, toast } from '@/utils/feedback';
import type { ParsedOtpAuth } from '@/utils/otpauth';

const props = defineProps<{ entryId: string | null; draft?: ParsedOtpAuth | null }>();
const emit = defineEmits<{ close: [] }>();

const totp = useTotpStore();
const { isMobile } = useDevice();
const saving = ref(false);

const { form, errors, validateAll, validateField, applyOtpauth, toPayload, previewEntry } = useEntryForm();

onMounted(async () => {
  await totp.loadEntries();

  if (props.draft) {
    Object.assign(form, {
      name: props.draft.name,
      issuer: props.draft.issuer,
      secret: props.draft.secret,
      advanced: { ...props.draft.advanced }
    });
    return;
  }

  if (!props.entryId) return;

  const found = totp.findById(props.entryId);
  if (!found) {
    toast('验证码不存在或已被删除', 'error');
    emit('close');
    return;
  }
  Object.assign(form, formFromEntry(found));
});

// 粘贴 otpauth:// 链接时自动识别
watch(
  () => form.secret,
  (value) => {
    if (!value.trim().toLowerCase().startsWith('otpauth://')) return;
    if (applyOtpauth()) toast('已从链接识别验证码信息', 'success');
    else toast('无法识别该 otpauth 链接', 'error');
  }
);

function handleValidate(field: EntryFormField): void {
  validateField(field);
}

async function handleSubmit(): Promise<void> {
  if (!validateAll()) {
    toast('请先修正表单中的错误', 'error');
    return;
  }

  saving.value = true;
  try {
    const payload = toPayload();
    if (props.entryId) {
      await totp.updateEntry(props.entryId, payload);
      toast('修改已保存', 'success');
    } else {
      await totp.addEntry(payload);
      toast('验证码已添加', 'success');
    }
    emit('close');
  } catch (error) {
    toast(error instanceof Error ? error.message : '保存失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(): Promise<void> {
  if (!props.entryId) return;

  const confirmed = await confirmDialog({
    title: '删除验证码',
    message: `确定删除「${form.issuer || form.name}」吗？删除后无法恢复。`,
    confirmText: '删除',
    danger: true
  });
  if (!confirmed) return;

  await totp.deleteEntry(props.entryId);
  toast('已删除', 'success');
  emit('close');
}
</script>

<template>
  <ModalShell
    :title="props.entryId ? '编辑验证码' : '新增验证码'"
    subtitle="密钥仅保存在本机，同步时使用端到端加密"
    size="lg"
    :close-on-backdrop="false"
    @close="emit('close')"
  >
    <div class="editor-layout">
      <section class="editor-main">
        <EntryFormMobile
          v-if="isMobile"
          :form="form"
          :errors="errors"
          :groups="totp.groups"
          @validate="handleValidate"
        />
        <EntryFormDesktop
          v-else
          :form="form"
          :errors="errors"
          :groups="totp.groups"
          @validate="handleValidate"
        />
      </section>

      <aside v-show="previewEntry || !isMobile" class="preview-card">
        <div class="preview-head">
          <h2>实时预览</h2>
          <span class="badge">本地生成</span>
        </div>

        <TotpCode v-if="previewEntry" :entry="previewEntry" size="lg" class="preview-code" />
        <p v-else class="preview-placeholder">填写有效的 Base32 密钥后，这里会实时显示验证码</p>

        <dl class="preview-meta">
          <div>
            <dt>服务商</dt>
            <dd>{{ form.issuer || '—' }}</dd>
          </div>
          <div>
            <dt>账号</dt>
            <dd>{{ form.name || '—' }}</dd>
          </div>
          <div>
            <dt>分组</dt>
            <dd>{{ form.group.trim() || DEFAULT_GROUP }}</dd>
          </div>
          <div>
            <dt>类型</dt>
            <dd>
              {{ form.advanced.type }}
              {{ form.advanced.type === 'STEAM' ? ' · 5 位' : ` · ${form.advanced.digits} 位` }}
            </dd>
          </div>
          <div>
            <dt>算法</dt>
            <dd>{{ form.advanced.type === 'STEAM' ? 'SHA1' : form.advanced.algorithm }}</dd>
          </div>
          <div>
            <dt>刷新间隔</dt>
            <dd>{{ form.advanced.type === 'STEAM' ? 30 : form.advanced.period }} 秒</dd>
          </div>
        </dl>

        <p class="preview-tip">
          <AppIcon name="shield" :size="14" />
          验证码由浏览器 Web Crypto 本地计算
        </p>
      </aside>
    </div>

    <template #footer>
      <button v-if="props.entryId" type="button" class="btn danger footer-delete" @click="handleDelete">
        <AppIcon name="trash" :size="15" />
        删除
      </button>
      <button type="button" class="btn ghost" @click="emit('close')">取消</button>
      <button type="button" class="btn primary" :disabled="saving" @click="handleSubmit">
        <AppIcon name="check" :size="15" />
        {{ saving ? '保存中…' : props.entryId ? '保存修改' : '保存验证码' }}
      </button>
    </template>
  </ModalShell>
</template>

<style scoped>
.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  align-items: start;
}

.editor-main {
  min-width: 0;
}

.preview-card {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-2);
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-head h2 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--success-ghost);
  color: var(--success);
  font-size: 10.5px;
  font-weight: 600;
}

.preview-code {
  width: 100%;
  padding: 10px;
  border-radius: var(--radius-md);
  background: var(--surface);
}

.preview-placeholder {
  margin: 0;
  padding: 18px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 12.5px;
  text-align: center;
  line-height: 1.6;
}

.preview-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.preview-meta div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border);
}

.preview-meta div:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.preview-meta dt {
  color: var(--text-muted);
  font-size: 12px;
}

.preview-meta dd {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12.5px;
  text-align: right;
  font-weight: 500;
  word-break: break-all;
}

.preview-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--text-muted);
  font-size: 11.5px;
}

.footer-delete {
  margin-right: auto;
}

@media (max-width: 900px) {
  .editor-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .preview-card {
    position: static;
    order: -1;
  }
}

@media (max-width: 767px) {
  .preview-card {
    padding: 12px;
    gap: 8px;
  }

  /* 移动端只保留实时验证码，元信息在表单里已可见 */
  .preview-meta,
  .preview-tip {
    display: none;
  }

  .footer-delete {
    height: 36px;
    padding: 0 10px;
  }
}
</style>
