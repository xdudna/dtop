<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import EntryTile from '@/components/desktop/EntryTile.vue';
import EntryCard from '@/components/mobile/EntryCard.vue';
import QrScanner from '@/components/mobile/QrScanner.vue';
import TimeBar from '@/components/TimeBar.vue';
import TotpCode from '@/components/TotpCode.vue';
import { useDevice } from '@/composables/useDevice';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useTotpStore } from '@/stores/totpStore';
import { useUiStore } from '@/stores/uiStore';
import { DEFAULT_GROUP } from '@/types/totp';
import type { TotpEntry } from '@/types/totp';
import { confirmDialog, toast } from '@/utils/feedback';
import type { ParsedOtpAuth } from '@/utils/otpauth';

const totp = useTotpStore();
const sync = useSyncStore();
const settings = useSettingsStore();
const ui = useUiStore();
const { isMobile } = useDevice();

const query = ref('');
const activeGroup = ref('ALL');
const scannerOpen = ref(false);

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return totp.sortedEntries.filter((entry) => {
    const group = entry.group.trim() || DEFAULT_GROUP;
    if (activeGroup.value !== 'ALL' && group !== activeGroup.value) return false;
    if (!keyword) return true;
    return [entry.name, entry.issuer, group, entry.note].some((value) =>
      value.toLowerCase().includes(keyword)
    );
  });
});

const needsAttention = computed(() => sync.state === 'remote-ahead' || sync.state === 'conflict');

onMounted(() => {
  totp.loadEntries();
});

function openAdd(): void {
  ui.openCreate();
}

function openScanner(): void {
  scannerOpen.value = true;
}

function handleScanned(parsed: ParsedOtpAuth): void {
  scannerOpen.value = false;
  ui.openCreate(parsed);
  toast('已识别二维码，请确认信息后保存', 'success');
}

function handleScannerManual(): void {
  scannerOpen.value = false;
  ui.openCreate();
}

function openEdit(entry: TotpEntry): void {
  ui.openEdit(entry.id);
}

function resetFilters(): void {
  query.value = '';
  activeGroup.value = 'ALL';
}

async function handleDelete(entry: TotpEntry): Promise<void> {
  const confirmed = await confirmDialog({
    title: '删除验证码',
    message: `确定删除「${entry.issuer || entry.name}」吗？删除后无法恢复。`,
    confirmText: '删除',
    danger: true
  });
  if (!confirmed) return;

  await totp.deleteEntry(entry.id);
  toast('已删除', 'success');
}
</script>

<template>
  <div class="page home-page">
    <TimeBar v-if="isMobile" class="mobile-time" />

    <p v-if="needsAttention" class="notice-card">
      <AppIcon name="sync" :size="17" />
      <span>{{ sync.stateDescription }}</span>
      <RouterLink to="/sync" class="link">去同步</RouterLink>
    </p>

    <section class="toolbar">
      <div class="toolbar-row">
        <el-input
          v-if="!isMobile"
          v-model="query"
          class="search-input"
          size="large"
          placeholder="搜索名称、服务商、分组或备注"
          clearable
        >
          <template #prefix><AppIcon name="search" :size="16" /></template>
        </el-input>
        <van-search
          v-else
          v-model="query"
          shape="round"
          placeholder="搜索名称、服务商或分组"
          class="mobile-search"
        />

        <button
          v-if="isMobile"
          type="button"
          class="scan-button"
          aria-label="扫码添加"
          title="扫码添加"
          @click="openScanner"
        >
          <AppIcon name="scan" :size="20" />
        </button>

        <TimeBar v-if="!isMobile" class="toolbar-time" />

        <div v-if="!isMobile" class="toolbar-actions">
          <div class="segmented view-toggle" role="group" aria-label="布局切换">
            <button
              type="button"
              :class="{ active: settings.settings.desktopView === 'cards' }"
              @click="settings.setDesktopView('cards')"
            >
              卡片
            </button>
            <button
              type="button"
              :class="{ active: settings.settings.desktopView === 'table' }"
              @click="settings.setDesktopView('table')"
            >
              表格
            </button>
          </div>
          <button type="button" class="btn primary add-button" @click="openAdd">
            <AppIcon name="plus" :size="16" />
            新增验证码
          </button>
        </div>
      </div>

      <div class="chips" role="tablist" aria-label="分组筛选">
        <button
          type="button"
          class="chip"
          :class="{ active: activeGroup === 'ALL' }"
          @click="activeGroup = 'ALL'"
        >
          全部
          <span class="chip-count">{{ totp.entries.length }}</span>
        </button>
        <button
          v-for="group in totp.groups"
          :key="group"
          type="button"
          class="chip"
          :class="{ active: activeGroup === group }"
          @click="activeGroup = group"
        >
          {{ group }}
        </button>
      </div>
    </section>

    <section
      v-if="!isMobile && filtered.length && settings.settings.desktopView === 'cards'"
      class="entry-grid"
    >
      <EntryTile
        v-for="entry in filtered"
        :key="entry.id"
        :entry="entry"
        @edit="openEdit(entry)"
        @delete="handleDelete(entry)"
      />
    </section>

    <section
      v-else-if="!isMobile && filtered.length"
      class="card table-card"
    >
      <el-table :data="filtered" row-key="id" class="entry-table" @row-dblclick="openEdit">
        <el-table-column label="名称" min-width="210">
          <template #default="{ row }">
            <div class="entry-primary">
              <span class="issuer">{{ row.issuer }}</span>
              <span class="account">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分组" width="110">
          <template #default="{ row }">
            <span class="group-pill">{{ row.group?.trim() || DEFAULT_GROUP }}</span>
          </template>
        </el-table-column>
        <el-table-column label="验证码" width="230">
          <template #default="{ row }">
            <TotpCode :entry="row" size="md" />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="note-text">{{ row.note || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="104" align="right">
          <template #default="{ row }">
            <div class="row-actions">
              <button type="button" class="icon-btn" title="编辑" @click.stop="openEdit(row)">
                <AppIcon name="edit" :size="16" />
              </button>
              <button type="button" class="icon-btn danger" title="删除" @click.stop="handleDelete(row)">
                <AppIcon name="trash" :size="16" />
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section
      v-else-if="isMobile && filtered.length"
      class="mobile-entry-grid"
      :class="{ 'single-column': settings.settings.mobileColumns === 1 }"
    >
      <EntryCard
        v-for="entry in filtered"
        :key="entry.id"
        :entry="entry"
        :compact="settings.settings.mobileColumns === 2"
        @edit="openEdit(entry)"
        @delete="handleDelete(entry)"
      />
    </section>

    <section v-if="!filtered.length" class="empty-state card">
      <span class="empty-icon"><AppIcon name="shield" :size="26" /></span>
      <h2>{{ totp.entries.length ? '没有匹配的验证码' : '添加你的第一个验证码' }}</h2>
      <p>
        {{
          totp.entries.length
            ? '换个关键词，或切换到「全部」分组看看'
            : '支持 TOTP 与 Steam Guard，密钥只保存在本机浏览器中'
        }}
      </p>
      <button v-if="!totp.entries.length" type="button" class="btn primary" @click="openAdd">
        <AppIcon name="plus" :size="16" />
        新增验证码
      </button>
      <button v-else type="button" class="btn ghost" @click="resetFilters">重置筛选</button>
    </section>

    <button v-if="isMobile" type="button" class="fab" aria-label="新增验证码" @click="openAdd">
      <AppIcon name="plus" :size="22" />
    </button>

    <QrScanner
      v-if="scannerOpen"
      @close="scannerOpen = false"
      @detected="handleScanned"
      @manual="handleScannerManual"
    />
  </div>
</template>

<style scoped>
.home-page {
  position: relative;
}

@media (max-width: 767px) {
  .home-page {
    /* 给右下角悬浮按钮留出空间，避免最后一行卡片被遮挡 */
    padding-bottom: 52px;
  }
}

.mobile-time {
  width: 100%;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-time {
  flex: none;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.view-toggle {
  flex: none;
}

.add-button {
  flex: none;
}

.search-input {
  flex: 1 1 240px;
  min-width: 190px;
  max-width: 420px;
}

.mobile-search {
  flex: 1;
  width: 100%;
  min-width: 0;
  padding: 0;
  background: transparent;
}

.scan-button {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    color 0.16s ease;
}

.scan-button:active {
  border-color: var(--primary);
  color: var(--primary-strong);
}

.mobile-search :deep(.van-search__content) {
  background: var(--surface);
  border: 1px solid var(--border);
}

.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.chips::-webkit-scrollbar {
  display: none;
}

.chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    color 0.16s ease,
    background-color 0.16s ease;
}

.chip:hover {
  border-color: var(--primary);
  color: var(--primary-strong);
}

.chip.active {
  border-color: transparent;
  background: var(--primary-ghost);
  color: var(--primary-strong);
  font-weight: 600;
}

.chip-count {
  font-size: 11px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

.table-card {
  overflow: hidden;
  padding: 0 6px;
}

.entry-grid {
  display: grid;
  /* 固定卡片宽度，一行能放几张由页面宽度决定 */
  grid-template-columns: repeat(auto-fill, 300px);
  justify-content: start;
  gap: 12px;
}

.entry-primary {
  display: flex;
  align-items: baseline;
  gap: 7px;
  min-width: 0;
  padding: 2px 0;
}

.issuer {
  flex: none;
  max-width: 58%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--text);
  font-size: 14px;
}

.account {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-muted);
}

.mobile-entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.mobile-entry-grid.single-column {
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.note-text {
  color: var(--text-muted);
  font-size: 12.5px;
}

.row-actions {
  display: inline-flex;
  gap: 2px;
  justify-content: flex-end;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 54px 24px;
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  margin-bottom: 6px;
  border-radius: 16px;
  background: var(--primary-ghost);
  color: var(--primary);
}

.empty-state h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.empty-state p {
  margin: 0 0 12px;
  max-width: 340px;
  color: var(--text-muted);
  font-size: 13px;
}

.notice-card {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--warning);
  border-radius: var(--radius-md);
  background: var(--warning-ghost);
  color: var(--text-secondary);
  font-size: 13px;
}

.notice-card .link {
  margin-left: auto;
  font-weight: 600;
}

.fab {
  position: fixed;
  right: 18px;
  bottom: calc(72px + env(safe-area-inset-bottom));
  z-index: 30;
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: 0;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  color: #fff;
  box-shadow: 0 12px 26px var(--primary-shadow);
  cursor: pointer;
}

.fab:active {
  transform: scale(0.96);
}

@media (max-width: 767px) {
  .page-head h1 {
    font-size: 22px;
  }
}
</style>
