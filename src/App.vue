<script setup lang="ts">
import { onMounted } from 'vue';

import EntryEditorPanel from '@/components/panels/EntryEditorPanel.vue';
import { useDevice } from '@/composables/useDevice';
import DesktopLayout from '@/layouts/DesktopLayout.vue';
import MobileLayout from '@/layouts/MobileLayout.vue';
import { useSyncStore } from '@/stores/syncStore';
import { useTotpStore } from '@/stores/totpStore';
import { useUiStore } from '@/stores/uiStore';

const { isMobile } = useDevice();
const totp = useTotpStore();
const sync = useSyncStore();
const ui = useUiStore();

onMounted(async () => {
  await totp.loadEntries();
  sync.init();
});
</script>

<template>
  <MobileLayout v-if="isMobile" />
  <DesktopLayout v-else />

  <EntryEditorPanel v-if="ui.editorOpen" :entry-id="ui.editingId" @close="ui.closeEditor" />
</template>
