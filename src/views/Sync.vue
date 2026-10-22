<script setup lang="ts">
import SyncContent from '@/components/sync/SyncContent.vue';
</script>

<template>
  <div class="page sync-page">
    <header class="page-head">
      <div>
        <h1>同步</h1>
        <p class="page-sub">
          通过 GitHub Gist / GitLab Snippet 在多设备间同步，数据使用 AES-GCM 加密
        </p>
      </div>
    </header>

    <SyncContent />
  </div>
</template>

<style scoped>
.sync-page {
  max-width: 1040px;
  margin: 0 auto;
}
</style>
