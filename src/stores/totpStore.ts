import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { getAllEntries, removeEntry, replaceEntries, saveEntry, clearEntries } from '@/db';
import { DEFAULT_GROUP } from '@/types/totp';
import type { TotpEntry } from '@/types/totp';
import { normalizeAdvanced } from '@/types/totp';
import { normalizeBase32 } from '@/utils/base32';
import { createId } from '@/utils/id';

export type EntryInput = Omit<TotpEntry, 'id' | 'createdAt' | 'updatedAt' | 'order'>;

export type ImportMode = 'merge' | 'replace';

/** 清洗任意来源的条目（导入 / 同步 / 旧版本数据） */
export function sanitizeEntry(raw: Partial<TotpEntry>, index = 0): TotpEntry {
  const now = Date.now();
  const createdAt = Number(raw.createdAt);
  const updatedAt = Number(raw.updatedAt);
  const order = Number(raw.order);

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : createId(),
    name: typeof raw.name === 'string' ? raw.name.trim() : '',
    issuer: typeof raw.issuer === 'string' ? raw.issuer.trim() : '',
    group: typeof raw.group === 'string' ? raw.group.trim() : '',
    note: typeof raw.note === 'string' ? raw.note : '',
    secret: normalizeBase32(typeof raw.secret === 'string' ? raw.secret : ''),
    advanced: normalizeAdvanced(raw.advanced),
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : now,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : now,
    order: Number.isFinite(order) ? order : index
  };
}

function sortByOrder(entries: TotpEntry[]): TotpEntry[] {
  return [...entries].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export const useTotpStore = defineStore('totp', () => {
  const entries = ref<TotpEntry[]>([]);
  const loaded = ref(false);
  const loading = ref(false);
  const error = ref('');

  const sortedEntries = computed(() => sortByOrder(entries.value));
  const count = computed(() => entries.value.length);

  /** 分组列表（空分组归入「默认」，默认分组排最后） */
  const groups = computed<string[]>(() => {
    const counter = new Map<string, number>();
    for (const entry of entries.value) {
      const group = entry.group.trim() || DEFAULT_GROUP;
      counter.set(group, (counter.get(group) ?? 0) + 1);
    }
    return [...counter.entries()]
      .sort((a, b) => {
        if (a[0] === DEFAULT_GROUP) return 1;
        if (b[0] === DEFAULT_GROUP) return -1;
        return b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN');
      })
      .map(([group]) => group);
  });

  async function loadEntries(force = false): Promise<void> {
    if (loaded.value && !force) return;
    loading.value = true;
    error.value = '';
    try {
      entries.value = sortByOrder(await getAllEntries());
      loaded.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '读取本地数据失败';
    } finally {
      loading.value = false;
    }
  }

  function findById(id: string): TotpEntry | undefined {
    return entries.value.find((entry) => entry.id === id);
  }

  function nextOrder(): number {
    return entries.value.reduce((max, entry) => Math.max(max, entry.order), -1) + 1;
  }

  async function addEntry(input: EntryInput): Promise<TotpEntry> {
    const now = Date.now();
    const entry: TotpEntry = {
      ...input,
      secret: normalizeBase32(input.secret),
      advanced: normalizeAdvanced(input.advanced),
      id: createId(),
      createdAt: now,
      updatedAt: now,
      order: nextOrder()
    };
    await saveEntry(entry);
    entries.value = sortByOrder([...entries.value, entry]);
    loaded.value = true;
    return entry;
  }

  async function updateEntry(id: string, patch: Partial<EntryInput>): Promise<TotpEntry | null> {
    const index = entries.value.findIndex((entry) => entry.id === id);
    if (index === -1) return null;

    const current = entries.value[index];
    const next: TotpEntry = {
      ...current,
      ...patch,
      secret: normalizeBase32(patch.secret ?? current.secret),
      advanced: normalizeAdvanced(patch.advanced ?? current.advanced),
      updatedAt: Date.now()
    };

    await saveEntry(next);
    entries.value = sortByOrder(entries.value.map((entry) => (entry.id === id ? next : entry)));
    return next;
  }

  async function deleteEntry(id: string): Promise<void> {
    await removeEntry(id);
    entries.value = entries.value.filter((entry) => entry.id !== id);
  }

  async function importEntries(data: Array<Partial<TotpEntry>>, mode: ImportMode = 'merge'): Promise<number> {
    const sanitized = data.map((item, index) => sanitizeEntry(item, index)).filter((item) => item.secret);

    if (mode === 'replace') {
      await replaceEntries(sanitized);
      entries.value = sortByOrder(sanitized);
    } else {
      const map = new Map(entries.value.map((entry) => [entry.id, entry]));
      for (const entry of sanitized) {
        const existing = map.get(entry.id);
        map.set(entry.id, existing ? { ...existing, ...entry, createdAt: existing.createdAt } : entry);
      }
      const merged = sortByOrder([...map.values()]);
      await replaceEntries(merged);
      entries.value = merged;
    }

    loaded.value = true;
    return sanitized.length;
  }

  async function clearAll(): Promise<void> {
    await clearEntries();
    entries.value = [];
    loaded.value = true;
  }

  function exportData(): TotpEntry[] {
    return entries.value.map((entry) => ({ ...entry, advanced: { ...entry.advanced } }));
  }

  return {
    entries,
    sortedEntries,
    groups,
    count,
    loaded,
    loading,
    error,
    loadEntries,
    findById,
    addEntry,
    updateEntry,
    deleteEntry,
    importEntries,
    clearAll,
    exportData
  };
});
