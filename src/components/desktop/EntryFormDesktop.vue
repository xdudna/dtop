<script setup lang="ts">
import { ref } from 'vue';

import type { EntryForm, EntryFormErrors, EntryFormField } from '@/composables/useEntryForm';

const props = defineProps<{
  form: EntryForm;
  errors: EntryFormErrors;
  groups: string[];
}>();

const emit = defineEmits<{
  validate: [field: EntryFormField];
}>();

const showAdvanced = ref(false);

function validate(field: EntryFormField): void {
  emit('validate', field);
}
</script>

<template>
  <el-form class="entry-form" label-position="top" @submit.prevent>
    <div class="form-grid">
      <el-form-item label="名称" :error="props.errors.name" required>
        <el-input
          v-model="props.form.name"
          placeholder="例如 alice@example.com"
          maxlength="100"
          @blur="validate('name')"
        />
      </el-form-item>

      <el-form-item label="服务商" :error="props.errors.issuer" required>
        <el-input
          v-model="props.form.issuer"
          placeholder="例如 GitHub"
          maxlength="100"
          @blur="validate('issuer')"
        />
      </el-form-item>
    </div>

    <div class="form-grid">
      <el-form-item label="分组" :error="props.errors.group">
        <el-select
          v-model="props.form.group"
          filterable
          allow-create
          default-first-option
          clearable
          placeholder="默认分组，可直接输入新分组"
          class="w-full"
        >
          <el-option v-for="group in props.groups" :key="group" :label="group" :value="group" />
        </el-select>
      </el-form-item>

      <el-form-item label="备注" :error="props.errors.note">
        <el-input
          v-model="props.form.note"
          maxlength="500"
          show-word-limit
          placeholder="可选，例如用途或绑定邮箱"
        />
        <p class="form-hint">备注会随条目一起加密同步。</p>
      </el-form-item>
    </div>

    <el-form-item label="密钥" :error="props.errors.secret" required>
      <el-input
        v-model="props.form.secret"
        class="mono-input"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 4 }"
        placeholder="Base32 密钥，例如 JBSWY3DPEHPK3PXP；也可直接粘贴 otpauth:// 链接"
        @blur="validate('secret')"
      />
      <p class="form-hint">支持空格分隔的密钥，粘贴 otpauth:// 链接会自动识别服务商与参数。</p>
    </el-form-item>

    <div class="advanced-toggle">
      <div class="advanced-copy">
        <strong>高级设置</strong>
        <p>STEAM · 哈希算法 · 刷新间隔 · 位数</p>
      </div>
      <el-switch v-model="showAdvanced" />
    </div>

    <div v-show="showAdvanced" class="advanced-panel">
      <div class="form-grid">
        <el-form-item label="类型">
          <el-radio-group v-model="props.form.advanced.type">
            <el-radio-button value="TOTP">TOTP</el-radio-button>
            <el-radio-button value="STEAM">STEAM</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="哈希算法">
          <el-radio-group
            v-model="props.form.advanced.algorithm"
            :disabled="props.form.advanced.type === 'STEAM'"
          >
            <el-radio-button value="SHA1">SHA1</el-radio-button>
            <el-radio-button value="SHA256">SHA256</el-radio-button>
            <el-radio-button value="SHA512">SHA512</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="刷新间隔（秒）" :error="props.errors.period">
          <el-input-number
            v-model="props.form.advanced.period"
            :min="10"
            :max="300"
            :step="5"
            :disabled="props.form.advanced.type === 'STEAM'"
            controls-position="right"
            @change="validate('period')"
          />
        </el-form-item>

        <el-form-item label="位数" :error="props.errors.digits">
          <el-radio-group
            v-model="props.form.advanced.digits"
            :disabled="props.form.advanced.type === 'STEAM'"
          >
            <el-radio-button :value="6">6 位</el-radio-button>
            <el-radio-button :value="8">8 位</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </div>

      <p class="form-hint">
        {{
          props.form.advanced.type === 'STEAM'
            ? 'Steam Guard 固定使用 30 秒刷新与 5 位字符，位数和算法不可修改。'
            : '默认 SHA1 / 30 秒 / 6 位，与绝大多数服务兼容。'
        }}
      </p>
    </div>
  </el-form>
</template>

<style scoped>
.entry-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
}

.w-full {
  width: 100%;
}

.mono-input :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
}

.advanced-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 6px 0 14px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.advanced-copy strong {
  font-size: 13.5px;
  color: var(--text);
}

.advanced-copy p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.advanced-panel {
  padding: 4px 16px 0;
  border-left: 2px solid var(--primary-ghost);
  margin-bottom: 8px;
}

.form-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
