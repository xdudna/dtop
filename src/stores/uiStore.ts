import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { ParsedOtpAuth } from '@/utils/otpauth';

export const useUiStore = defineStore('ui', () => {
  const editorOpen = ref(false);
  const editingId = ref<string | null>(null);
  const editorDraft = ref<ParsedOtpAuth | null>(null);

  function openCreate(draft: ParsedOtpAuth | null = null): void {
    editingId.value = null;
    editorDraft.value = draft;
    editorOpen.value = true;
  }

  function openEdit(id: string): void {
    editingId.value = id;
    editorDraft.value = null;
    editorOpen.value = true;
  }

  function closeEditor(): void {
    editorOpen.value = false;
    editingId.value = null;
    editorDraft.value = null;
  }

  return {
    editorOpen,
    editingId,
    editorDraft,
    openCreate,
    openEdit,
    closeEditor
  };
});
