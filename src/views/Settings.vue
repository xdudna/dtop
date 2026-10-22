<script setup lang="ts">
import SettingsContent from '@/components/settings/SettingsContent.vue';
</script>

<template>
  <div class="page settings-page">
    <header class="page-head">
      <div>
        <h1>设置</h1>
        <p class="page-sub">外观、显示与本地数据管理</p>
      </div>
    </header>

    <SettingsContent />
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 960px;
  margin: 0 auto;
}
</style>
