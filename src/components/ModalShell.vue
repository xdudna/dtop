<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import AppIcon from '@/components/AppIcon.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    size?: 'md' | 'lg';
    closeOnBackdrop?: boolean;
  }>(),
  {
    subtitle: '',
    size: 'lg',
    closeOnBackdrop: true
  }
);

const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);
let previousOverflow = '';

function close(): void {
  emit('close');
}

function handleBackdrop(): void {
  if (props.closeOnBackdrop) close();
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close();
}

onMounted(() => {
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', handleKeydown);
  requestAnimationFrame(() => panel.value?.focus());
});

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow;
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div class="modal-backdrop" @click.self="handleBackdrop">
        <section
          ref="panel"
          class="modal-panel"
          :class="`size-${props.size}`"
          role="dialog"
          aria-modal="true"
          :aria-label="props.title"
          tabindex="-1"
        >
          <header class="modal-head">
            <div class="modal-title">
              <h2>{{ props.title }}</h2>
              <p v-if="props.subtitle">{{ props.subtitle }}</p>
            </div>
            <button type="button" class="icon-btn modal-close" aria-label="关闭" @click="close">
              <AppIcon name="close" :size="18" />
            </button>
          </header>

          <div class="modal-body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(12, 16, 24, 0.52);
  backdrop-filter: blur(4px);
}

.modal-panel {
  display: flex;
  flex-direction: column;
  width: min(680px, 100%);
  max-height: min(88vh, 900px);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 32px 80px -32px rgba(8, 12, 20, 0.6);
  outline: none;
}

.modal-panel.size-lg {
  width: min(940px, 100%);
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}

.modal-title h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.modal-title p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.modal-close {
  flex: none;
  margin-top: 2px;
}

.modal-body {
  flex: 1;
  min-height: 0;
  padding: 20px 22px;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition:
    transform 0.22s ease,
    opacity 0.22s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(14px) scale(0.99);
}

@media (max-width: 767px) {
  .modal-backdrop {
    padding: 0;
    background: var(--bg);
    backdrop-filter: none;
  }

  .modal-panel,
  .modal-panel.size-lg {
    width: 100%;
    height: 100%;
    max-height: 100%;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .modal-head {
    padding: calc(14px + env(safe-area-inset-top)) 16px 12px;
  }

  .modal-title h2 {
    font-size: 18px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-footer {
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  }

  .modal-enter-from .modal-panel,
  .modal-leave-to .modal-panel {
    opacity: 0;
    transform: translateY(24px);
  }
}
</style>
