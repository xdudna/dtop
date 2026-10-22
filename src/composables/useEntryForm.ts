import { computed, reactive } from 'vue';

import type { EntryInput } from '@/stores/totpStore';
import type { TotpAdvanced, TotpEntry } from '@/types/totp';
import { createAdvanced, normalizeAdvanced } from '@/types/totp';
import { isValidBase32, normalizeBase32 } from '@/utils/base32';
import { parseOtpauthUri } from '@/utils/otpauth';

export interface EntryForm {
  name: string;
  issuer: string;
  group: string;
  note: string;
  secret: string;
  advanced: TotpAdvanced;
}

export type EntryFormField = 'name' | 'issuer' | 'group' | 'note' | 'secret' | 'period' | 'digits';

export type EntryFormErrors = Partial<Record<EntryFormField, string>>;

export function createEmptyForm(): EntryForm {
  return {
    name: '',
    issuer: '',
    group: '',
    note: '',
    secret: '',
    advanced: createAdvanced()
  };
}

export function formFromEntry(entry: TotpEntry): EntryForm {
  return {
    name: entry.name,
    issuer: entry.issuer,
    group: entry.group,
    note: entry.note,
    secret: entry.secret,
    advanced: { ...entry.advanced }
  };
}

/** 新增 / 编辑表单的共享状态与校验逻辑 */
export function useEntryForm(initial?: TotpEntry) {
  const form = reactive<EntryForm>(initial ? formFromEntry(initial) : createEmptyForm());
  const errors = reactive<EntryFormErrors>({});

  function fieldError(field: EntryFormField): string {
    switch (field) {
      case 'name': {
        const value = form.name.trim();
        if (!value) return '请输入名称';
        if (value.length > 100) return '名称不能超过 100 个字符';
        return '';
      }
      case 'issuer': {
        const value = form.issuer.trim();
        if (!value) return '请输入服务商';
        if (value.length > 100) return '服务商不能超过 100 个字符';
        return '';
      }
      case 'group': {
        if (form.group.trim().length > 50) return '分组不能超过 50 个字符';
        return '';
      }
      case 'note': {
        if (form.note.length > 500) return '备注不能超过 500 个字符';
        return '';
      }
      case 'secret': {
        const value = normalizeBase32(form.secret);
        if (!value) return '请输入密钥';
        if (!isValidBase32(value)) return '密钥必须是 Base32 编码（仅 A-Z 与 2-7）';
        if (value.length < 8) return '密钥长度至少 8 位';
        return '';
      }
      case 'period': {
        if (form.advanced.type === 'STEAM') return '';
        const value = Number(form.advanced.period);
        if (!Number.isInteger(value) || value < 10 || value > 300) {
          return '刷新间隔需在 10 - 300 秒之间';
        }
        return '';
      }
      case 'digits': {
        if (form.advanced.type === 'STEAM') return '';
        if (form.advanced.digits !== 6 && form.advanced.digits !== 8) return '位数只能是 6 或 8';
        return '';
      }
      default:
        return '';
    }
  }

  function validateField(field: EntryFormField): boolean {
    const message = fieldError(field);
    if (message) errors[field] = message;
    else delete errors[field];
    return !message;
  }

  function validateAll(): boolean {
    const fields: EntryFormField[] = ['name', 'issuer', 'group', 'note', 'secret', 'period', 'digits'];
    let valid = true;
    for (const field of fields) {
      if (!validateField(field)) valid = false;
    }
    return valid;
  }

  /** 支持直接把 otpauth:// 链接粘贴到密钥框 */
  function applyOtpauth(): boolean {
    const parsed = parseOtpauthUri(form.secret);
    if (!parsed) return false;

    if (parsed.name) form.name = parsed.name;
    if (parsed.issuer) form.issuer = parsed.issuer;
    form.secret = parsed.secret;
    form.advanced = parsed.advanced;
    validateField('secret');
    validateField('period');
    validateField('digits');
    return true;
  }

  function toPayload(): EntryInput {
    return {
      name: form.name.trim(),
      issuer: form.issuer.trim(),
      group: form.group.trim(),
      note: form.note.trim(),
      secret: normalizeBase32(form.secret),
      advanced: normalizeAdvanced(form.advanced)
    };
  }

  const previewEntry = computed<TotpEntry | null>(() => {
    const secret = normalizeBase32(form.secret);
    if (!isValidBase32(secret) || secret.length < 8) return null;

    return {
      id: 'preview',
      name: form.name.trim() || '预览',
      issuer: form.issuer.trim(),
      group: form.group.trim(),
      note: '',
      secret,
      advanced: normalizeAdvanced(form.advanced),
      createdAt: 0,
      updatedAt: 0,
      order: 0
    };
  });

  return { form, errors, validateField, validateAll, applyOtpauth, toPayload, previewEntry };
}
