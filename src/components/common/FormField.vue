<script setup lang="ts">
import { useDevice } from '@/composables/useDevice';

const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: string;
    placeholder?: string;
    type?: 'text' | 'password' | 'textarea';
    hint?: string;
    error?: string;
    autocomplete?: string;
    maxlength?: number;
    disabled?: boolean;
    monospace?: boolean;
  }>(),
  {
    placeholder: '',
    type: 'text',
    hint: '',
    error: '',
    autocomplete: 'off',
    maxlength: undefined,
    disabled: false,
    monospace: false
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  blur: [];
}>();

const { isMobile } = useDevice();

function update(value: string): void {
  emit('update:modelValue', value);
}

function onInput(event: Event): void {
  update((event.target as HTMLInputElement | HTMLTextAreaElement).value);
}
</script>

<template>
  <div class="form-field" :class="{ 'is-mono': props.monospace }">
    <template v-if="!isMobile">
      <label class="field-label">{{ props.label }}</label>
      <el-input
        :model-value="props.modelValue"
        :type="props.type === 'textarea' ? 'textarea' : props.type"
        :placeholder="props.placeholder"
        :autocomplete="props.autocomplete"
        :maxlength="props.maxlength"
        :disabled="props.disabled"
        :show-password="props.type === 'password'"
        :autosize="props.type === 'textarea' ? { minRows: 2, maxRows: 4 } : undefined"
        @update:model-value="update"
        @blur="emit('blur')"
      />
      <p v-if="props.hint" class="field-hint">{{ props.hint }}</p>
      <p v-if="props.error" class="field-error">{{ props.error }}</p>
    </template>

    <label v-else class="mobile-field">
      <span class="mobile-label">{{ props.label }}</span>
      <textarea
        v-if="props.type === 'textarea'"
        :value="props.modelValue"
        :placeholder="props.placeholder"
        :maxlength="props.maxlength"
        :disabled="props.disabled"
        rows="3"
        @input="onInput"
        @blur="emit('blur')"
      ></textarea>
      <input
        v-else
        :type="props.type"
        :value="props.modelValue"
        :placeholder="props.placeholder"
        :autocomplete="props.autocomplete"
        :maxlength="props.maxlength"
        :disabled="props.disabled"
        @input="onInput"
        @blur="emit('blur')"
      />
      <span v-if="props.hint" class="field-hint">{{ props.hint }}</span>
      <span v-if="props.error" class="field-error">{{ props.error }}</span>
    </label>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field-label {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
}

.is-mono :deep(input),
.is-mono :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.03em;
}

.field-hint {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-muted);
}

.field-error {
  margin: 0;
  font-size: 11.5px;
  color: var(--danger);
}

/* 移动端：标签在上、输入框占满整行 */
.mobile-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.mobile-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.mobile-field input,
.mobile-field textarea {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 13.5px;
  line-height: 1.45;
  outline: none;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.mobile-field textarea {
  min-height: 68px;
  resize: vertical;
}

.mobile-field input:focus,
.mobile-field textarea:focus {
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--primary-ghost);
}

.mobile-field input:disabled,
.mobile-field textarea:disabled {
  opacity: 0.6;
}
</style>
