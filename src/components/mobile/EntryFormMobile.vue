<script setup lang="ts">
import { ref } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import type { EntryForm, EntryFormErrors, EntryFormField } from '@/composables/useEntryForm';
import type { TotpAdvanced } from '@/types/totp';

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

function setType(type: TotpAdvanced['type']): void {
  props.form.advanced.type = type;
  emit('validate', 'period');
  emit('validate', 'digits');
}
</script>

<template>
  <div class="mobile-form">
    <van-cell-group inset class="field-group">
      <van-field
        v-model="props.form.name"
        label="名称"
        placeholder="例如 alice@example.com"
        maxlength="100"
        required
        :error-message="props.errors.name"
        @blur="validate('name')"
      />
      <van-field
        v-model="props.form.issuer"
        label="服务商"
        placeholder="例如 GitHub"
        maxlength="100"
        required
        :error-message="props.errors.issuer"
        @blur="validate('issuer')"
      />
      <van-field
        v-model="props.form.group"
        label="分组"
        placeholder="默认分组"
        maxlength="50"
        :error-message="props.errors.group"
        @blur="validate('group')"
      />
      <van-field
        v-model="props.form.note"
        label="备注"
        type="textarea"
        rows="2"
        autosize
        maxlength="500"
        placeholder="可选，会随条目一起同步"
        :error-message="props.errors.note"
        @blur="validate('note')"
      />
      <van-field
        v-model="props.form.secret"
        label="密钥"
        type="textarea"
        rows="2"
        autosize
        required
        placeholder="Base32 密钥或 otpauth:// 链接"
        :error-message="props.errors.secret"
        @blur="validate('secret')"
      />
    </van-cell-group>

    <div v-if="props.groups.length" class="group-suggest">
      <span class="suggest-label">已有分组</span>
      <button
        v-for="group in props.groups"
        :key="group"
        type="button"
        class="chip"
        :class="{ active: props.form.group === group }"
        @click="props.form.group = group"
      >
        {{ group }}
      </button>
    </div>

    <section class="advanced-box">
      <button type="button" class="advanced-head" @click="showAdvanced = !showAdvanced">
        <span>
          <strong>高级设置</strong>
          <small>STEAM · 哈希算法 · 刷新间隔 · 位数</small>
        </span>
        <span class="chevron" :class="{ open: showAdvanced }">
          <AppIcon name="chevronRight" :size="16" />
        </span>
      </button>

      <div v-show="showAdvanced" class="advanced-body">
        <div class="adv-row">
          <span class="adv-label">类型</span>
          <div class="segmented">
            <button
              type="button"
              :class="{ active: props.form.advanced.type === 'TOTP' }"
              @click="setType('TOTP')"
            >
              TOTP
            </button>
            <button
              type="button"
              :class="{ active: props.form.advanced.type === 'STEAM' }"
              @click="setType('STEAM')"
            >
              STEAM
            </button>
          </div>
        </div>

        <div class="adv-row">
          <span class="adv-label">哈希算法</span>
          <div class="segmented" :class="{ disabled: props.form.advanced.type === 'STEAM' }">
            <button
              v-for="algorithm in ['SHA1', 'SHA256', 'SHA512']"
              :key="algorithm"
              type="button"
              :disabled="props.form.advanced.type === 'STEAM'"
              :class="{ active: props.form.advanced.algorithm === algorithm }"
              @click="props.form.advanced.algorithm = algorithm as TotpAdvanced['algorithm']"
            >
              {{ algorithm }}
            </button>
          </div>
        </div>

        <div class="adv-row">
          <span class="adv-label">刷新间隔</span>
          <div class="adv-value">
            <van-stepper
              v-model="props.form.advanced.period"
              :min="10"
              :max="300"
              :step="5"
              integer
              :disabled="props.form.advanced.type === 'STEAM'"
              @change="validate('period')"
            />
            <span class="unit">秒</span>
          </div>
        </div>

        <div class="adv-row">
          <span class="adv-label">位数</span>
          <div class="segmented" :class="{ disabled: props.form.advanced.type === 'STEAM' }">
            <button
              type="button"
              :disabled="props.form.advanced.type === 'STEAM'"
              :class="{ active: props.form.advanced.digits === 6 }"
              @click="props.form.advanced.digits = 6"
            >
              6 位
            </button>
            <button
              type="button"
              :disabled="props.form.advanced.type === 'STEAM'"
              :class="{ active: props.form.advanced.digits === 8 }"
              @click="props.form.advanced.digits = 8"
            >
              8 位
            </button>
          </div>
        </div>

        <p class="adv-hint">
          {{
            props.form.advanced.type === 'STEAM'
              ? 'Steam Guard 固定为 30 秒刷新与 5 位字符。'
              : '默认 SHA1 / 30 秒 / 6 位，与绝大多数服务兼容。'
          }}
        </p>
      </div>
    </section>

    <p v-if="props.errors.period || props.errors.digits" class="form-error">
      {{ props.errors.period || props.errors.digits }}
    </p>
  </div>
</template>

<style scoped>
.mobile-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-group {
  margin: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.group-suggest {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.suggest-label {
  font-size: 12px;
  color: var(--text-muted);
}

.chip {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.chip.active {
  border-color: transparent;
  background: var(--primary-ghost);
  color: var(--primary-strong);
}

.advanced-box {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
}

.advanced-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.advanced-head strong {
  display: block;
  font-size: 13.5px;
  color: var(--text);
}

.advanced-head small {
  display: block;
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--text-muted);
}

.chevron {
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.chevron.open {
  transform: rotate(90deg);
}

.advanced-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 16px 16px;
}

.adv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 34px;
}

.adv-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.adv-value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.unit {
  font-size: 12px;
  color: var(--text-muted);
}

.segmented {
  display: inline-flex;
  padding: 3px;
  gap: 3px;
  border-radius: 9px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.segmented.disabled {
  opacity: 0.55;
}

.segmented button {
  padding: 5px 11px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.segmented button.active {
  background: var(--surface);
  color: var(--primary-strong);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}

.segmented button:disabled {
  cursor: not-allowed;
}

.adv-hint {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-muted);
}

.form-error {
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--danger-ghost);
  color: var(--danger);
  font-size: 12px;
}
</style>
