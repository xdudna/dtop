import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const editorOpen = ref(false);
  const editingId = ref<string | null>(null);

  function openCreate(): void {
    editingId.value = null;
    editorOpen.value = true;
  }

  function openEdit(id: string): void {
    editingId.value = id;
    editorOpen.value = true;
  }

  function closeEditor(): void {
    editorOpen.value = false;
    editingId.value = null;
  }

  return {
    editorOpen,
    editingId,
    openCreate,
    openEdit,
    closeEditor
  };
});
