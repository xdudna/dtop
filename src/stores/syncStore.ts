import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';

import { GitHubApi } from '@/api/github';
import { GitLabApi } from '@/api/gitlab';
import { ApiError } from '@/api/http';
import {
  ERROR_CODES,
  STORAGE_KEYS,
  SYNC_DATA_FILE,
  SYNC_DESCRIPTION,
  SYNC_META_FILE,
  SYNC_SINGLE_FILE
} from '@/constants';
import { decryptData, encryptData } from '@/crypto/encrypt';
import { useTotpStore } from '@/stores/totpStore';
import { sanitizeEntry } from '@/stores/totpStore';
import type { GitLabSyncDocument, SyncConfig, SyncMeta, SyncPayload, SyncProvider, SyncSnapshot, SyncState } from '@/types/sync';
import type { TotpEntry } from '@/types/totp';
import { sha256Hex } from '@/utils/hash';

type SyncApi = GitHubApi | GitLabApi;

interface RemoteSnapshot {
  meta: SyncMeta;
  payload: SyncPayload;
}

const DEFAULT_CONFIG: SyncConfig = {
  enabled: false,
  provider: 'github',
  baseUrl: '',
  pat: '',
  gistId: '',
  encryptionKey: ''
};

const STATUS_LABELS: Record<SyncState, string> = {
  unconfigured: '未配置',
  'no-remote': '未创建远端',
  synced: '已同步',
  'local-ahead': '本地有更新',
  'remote-ahead': '远端有更新',
  conflict: '存在冲突'
};

const STATUS_TONES: Record<SyncState, 'info' | 'success' | 'warning' | 'danger'> = {
  unconfigured: 'info',
  'no-remote': 'info',
  synced: 'success',
  'local-ahead': 'warning',
  'remote-ahead': 'warning',
  conflict: 'danger'
};

function loadConfig(): SyncConfig {
  const config: SyncConfig = { ...DEFAULT_CONFIG };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.syncConfig);
    if (!raw) return config;
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    config.enabled = Boolean(parsed.enabled);
    config.provider = parsed.provider === 'gitlab' ? 'gitlab' : 'github';
    config.baseUrl = typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '';
    config.pat = typeof parsed.pat === 'string' ? parsed.pat : '';
    config.gistId = typeof parsed.gistId === 'string' ? parsed.gistId : '';
  } catch {
    // 忽略损坏的本地配置
  }
  return config;
}

function loadSnapshot(): SyncSnapshot {
  const snapshot: SyncSnapshot = { localVersion: 0, lastSyncTime: 0, lastChecksum: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.syncSnapshot);
    if (!raw) return snapshot;
    const parsed = JSON.parse(raw) as Partial<SyncSnapshot>;
    snapshot.localVersion = Number.isFinite(Number(parsed.localVersion)) ? Number(parsed.localVersion) : 0;
    snapshot.lastSyncTime = Number.isFinite(Number(parsed.lastSyncTime)) ? Number(parsed.lastSyncTime) : 0;
    snapshot.lastChecksum = typeof parsed.lastChecksum === 'string' ? parsed.lastChecksum : '';
  } catch {
    // 忽略损坏的本地快照
  }
  return snapshot;
}

function canonicalEntries(entries: TotpEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(
    sorted.map((entry) => ({
      id: entry.id,
      name: entry.name,
      issuer: entry.issuer,
      group: entry.group,
      note: entry.note,
      secret: entry.secret,
      type: entry.advanced.type,
      algorithm: entry.advanced.algorithm,
      period: entry.advanced.period,
      digits: entry.advanced.digits
    }))
  );
}

async function checksumOf(entries: TotpEntry[]): Promise<string> {
  return sha256Hex(canonicalEntries(entries));
}

function parseJson(value: unknown, label: string): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new ApiError(`${label}格式错误`);
  }
}

function parseMeta(value: unknown): SyncMeta {
  const raw = parseJson(value, '远端元信息');
  if (!raw || typeof raw !== 'object') throw new ApiError('远端元信息格式错误');
  const record = raw as Partial<SyncMeta>;
  const version = Number(record.version);
  if (!Number.isFinite(version) || version < 0 || typeof record.checksum !== 'string') {
    throw new ApiError('远端元信息格式错误');
  }
  return {
    version,
    lastSyncTime: Number(record.lastSyncTime) || 0,
    checksum: record.checksum
  };
}

function parsePayload(value: unknown): SyncPayload {
  const raw = parseJson(value, '远端数据');
  if (!raw || typeof raw !== 'object') throw new ApiError('远端数据格式错误');
  const record = raw as Partial<SyncPayload>;
  if (
    typeof record.encryptedData !== 'string' ||
    typeof record.iv !== 'string' ||
    typeof record.salt !== 'string'
  ) {
    throw new ApiError('远端数据格式错误');
  }
  return {
    version: Number(record.version) || 0,
    encryptedData: record.encryptedData,
    iv: record.iv,
    salt: record.salt
  };
}

function parseEntries(plaintext: string): TotpEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new ApiError('远端数据解析失败');
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { entries?: unknown }).entries)
      ? (parsed as { entries: unknown[] }).entries
      : null;

  if (!list) throw new ApiError('远端数据格式不正确');

  return list
    .filter((item): item is Partial<TotpEntry> => Boolean(item) && typeof item === 'object')
    .map((item, index) => sanitizeEntry(item, index))
    .filter((item) => item.secret);
}

export const useSyncStore = defineStore('sync', () => {
  const config = reactive<SyncConfig>(loadConfig());
  const snapshot = reactive<SyncSnapshot>(loadSnapshot());

  const localVersion = computed(() => snapshot.localVersion);
  const lastSyncTime = computed(() => snapshot.lastSyncTime);
  const lastChecksum = computed(() => snapshot.lastChecksum);
  const remoteVersion = ref(0);
  const remoteChecksum = ref('');
  const localChecksum = ref('');
  const busy = ref(false);
  const statusMessage = ref('');
  const errorMessage = ref('');
  const account = ref('');
  const verifying = ref(false);
  const autoPush = ref(true);
  const initialized = ref(false);

  const configured = computed(() => Boolean(config.pat.trim()));
  /** 已绑定远端（Gist / Snippet）时不允许切换平台 */
  const providerLocked = computed(() => Boolean(config.gistId));
  const hasRemote = computed(() => Boolean(config.gistId) || remoteVersion.value > 0);
  const state = computed<SyncState>(() => {
    if (!config.pat.trim()) return 'unconfigured';
    if (!hasRemote.value) return 'no-remote';

    const localChanged = Boolean(localChecksum.value) && localChecksum.value !== snapshot.lastChecksum;
    if (remoteVersion.value > snapshot.localVersion) {
      return localChanged ? 'conflict' : 'remote-ahead';
    }
    if (localChanged) return 'local-ahead';
    return 'synced';
  });
  const stateLabel = computed(() => STATUS_LABELS[state.value]);
  const stateTone = computed(() => STATUS_TONES[state.value]);
  const stateDescription = computed(() => {
    switch (state.value) {
      case 'unconfigured':
        return '填写 Personal Access Token 后即可使用加密同步';
      case 'no-remote':
        return '首次推送时会自动创建远端 Gist / Snippet';
      case 'synced':
        return '本地数据与远端一致';
      case 'local-ahead':
        return '本地有改动尚未推送';
      case 'remote-ahead':
        return '远端存在更新版本，建议先拉取';
      case 'conflict':
        return '本地与远端都有改动，请确认覆盖方向';
      default:
        return '';
    }
  });

  function persist(): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.syncConfig,
        JSON.stringify({
          enabled: config.enabled,
          provider: config.provider,
          baseUrl: config.baseUrl,
          pat: config.pat,
          gistId: config.gistId
        })
      );
      localStorage.setItem(STORAGE_KEYS.syncSnapshot, JSON.stringify({ ...snapshot }));
    } catch {
      // 忽略存储失败
    }
  }

  function getApi(): SyncApi {
    return config.provider === 'github'
      ? new GitHubApi(config.pat, config.baseUrl)
      : new GitLabApi(config.pat, config.baseUrl);
  }

  function requirePat(): string {
    const pat = config.pat.trim();
    if (!pat) throw new Error('请先填写 Personal Access Token');
    return pat;
  }

  function requireKey(key?: string): string {
    const value = (key ?? config.encryptionKey).trim();
    if (!value) throw new Error('请先填写加密密钥');
    if (value.length < 8) throw new Error('加密密钥至少需要 8 位字符');
    return value;
  }

  function clearMessages(): void {
    statusMessage.value = '';
    errorMessage.value = '';
  }

  function handleError(error: unknown): void {
    errorMessage.value = error instanceof Error ? error.message : '同步操作失败';
    statusMessage.value = '';
  }

  /** 修改同步平台；已绑定远端时拒绝切换，需先解除关联 */
  function setProvider(provider: SyncProvider): boolean {
    if (config.provider === provider) return true;
    if (config.gistId) return false;

    config.provider = provider;
    config.baseUrl = '';
    config.gistId = '';
    remoteVersion.value = 0;
    remoteChecksum.value = '';
    clearMessages();
    persist();
    return true;
  }

  /** 尝试在账号中寻找已有的 dtop 同步 Gist / Snippet */
  async function adoptExistingRemote(): Promise<boolean> {
    const api = getApi();
    if (config.provider === 'github') {
      const gists = await (api as GitHubApi).listGists();
      const found = gists.find(
        (gist) => gist.description === SYNC_DESCRIPTION || Boolean(gist.files?.[SYNC_META_FILE])
      );
      if (found) {
        config.gistId = found.id;
        persist();
        return true;
      }
      return false;
    }

    const snippets = await (api as GitLabApi).listSnippets();
    const found = snippets.find(
      (snippet) => snippet.title === SYNC_DESCRIPTION || snippet.title.includes('dtop')
    );
    if (found) {
      config.gistId = String(found.id);
      persist();
      return true;
    }
    return false;
  }

  async function readRemote(): Promise<RemoteSnapshot | null> {
    if (!config.gistId) return null;
    const api = getApi();

    if (config.provider === 'github') {
      const gist = await (api as GitHubApi).getGist(config.gistId);
      const metaFile = gist.files?.[SYNC_META_FILE];
      const dataFile = gist.files?.[SYNC_DATA_FILE];
      if (!metaFile || !dataFile) {
        throw new ApiError('远端 Gist 缺少同步文件，可能不是 dtop 创建的 Gist');
      }
      return {
        meta: parseMeta(metaFile.content ?? ''),
        payload: parsePayload(dataFile.content ?? '')
      };
    }

    const content = await (api as GitLabApi).getSnippetContent(config.gistId);
    const document = parseJson(content, '远端数据') as Partial<GitLabSyncDocument>;
    return {
      meta: parseMeta(document.meta ?? ''),
      payload: parsePayload(document.payload ?? '')
    };
  }

  /** 检查远端状态，返回同步状态 */
  async function checkRemote(): Promise<SyncState> {
    requirePat();
    busy.value = true;
    clearMessages();

    try {
      if (!config.gistId) {
        try {
          await adoptExistingRemote();
        } catch {
          // 找不到已有远端时忽略，后续推送会创建
        }
      }

      if (!config.gistId) {
        remoteVersion.value = 0;
        remoteChecksum.value = '';
        statusMessage.value =
          config.provider === 'github'
            ? '远端尚未创建，首次推送会自动新建 Gist'
            : '远端尚未创建，首次推送会自动新建 Snippet';
        return state.value;
      }

      const remote = await readRemote();
      if (!remote) {
        remoteVersion.value = 0;
        return state.value;
      }

      remoteVersion.value = remote.meta.version;
      remoteChecksum.value = remote.meta.checksum;
      statusMessage.value =
        remote.meta.version > snapshot.localVersion
          ? `远端有新版本 v${remote.meta.version}，可以拉取`
          : '远端与本地版本一致';
      return state.value;
    } catch (error) {
      handleError(error);
      return state.value;
    } finally {
      busy.value = false;
    }
  }

  /** 从远端拉取并覆盖本地数据 */
  async function pull(key?: string): Promise<number> {
    requirePat();
    const password = requireKey(key);
    busy.value = true;
    clearMessages();

    try {
      if (!config.gistId) {
        throw new Error('尚未关联远端，请先推送一次');
      }

      const remote = await readRemote();
      if (!remote) throw new Error('远端不存在');

      const plaintext = await decryptData(
        remote.payload.encryptedData,
        remote.payload.iv,
        remote.payload.salt,
        password
      );
      const data = parseEntries(plaintext);
      const totpStore = useTotpStore();
      const imported = await totpStore.importEntries(data, 'replace');

      snapshot.localVersion = remote.meta.version;
      snapshot.lastChecksum = remote.meta.checksum;
      snapshot.lastSyncTime = Date.now();
      remoteVersion.value = remote.meta.version;
      remoteChecksum.value = remote.meta.checksum;
      config.encryptionKey = password;
      statusMessage.value = `已从远端拉取 ${imported} 条记录（v${remote.meta.version}）`;
      persist();
      return imported;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      busy.value = false;
    }
  }

  /** 加密并推送本地数据到远端；推送前先用远端最新数据校验密钥 */
  async function push(force = false, key?: string): Promise<SyncMeta> {
    requirePat();
    const password = requireKey(key);
    busy.value = true;
    clearMessages();

    try {
      const totpStore = useTotpStore();
      const data = totpStore.exportData();
      if (data.length === 0) {
        throw new Error('本地没有可同步的数据');
      }

      const checksum = await checksumOf(data);
      let remoteSnapshot: RemoteSnapshot | null = null;

      if (config.gistId) {
        try {
          remoteSnapshot = await readRemote();
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
      }

      // 先用远端最新密文验证密钥：能解密说明两端密钥一致
      if (remoteSnapshot) {
        try {
          await decryptData(
            remoteSnapshot.payload.encryptedData,
            remoteSnapshot.payload.iv,
            remoteSnapshot.payload.salt,
            password
          );
        } catch {
          throw new ApiError(
            '密钥校验失败：无法解密远端最新数据，已取消推送',
            undefined,
            ERROR_CODES.SYNC_DECRYPT_FAILED
          );
        }
      }

      const remoteMeta = remoteSnapshot?.meta ?? null;

      if (remoteMeta && remoteMeta.version > snapshot.localVersion && !force) {
        throw new ApiError(
          '远端存在更新版本，请先拉取远端数据，或选择强制覆盖',
          undefined,
          ERROR_CODES.SYNC_VERSION_MISMATCH
        );
      }

      const version = Math.max(snapshot.localVersion, remoteMeta?.version ?? 0) + 1;
      const encrypted = await encryptData(JSON.stringify(data), password);
      const payload: SyncPayload = {
        version,
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        salt: encrypted.salt
      };
      const meta: SyncMeta = { version, lastSyncTime: Date.now(), checksum };

      const api = getApi();
      if (config.provider === 'github') {
        const files = {
          [SYNC_META_FILE]: { content: JSON.stringify(meta, null, 2) },
          [SYNC_DATA_FILE]: { content: JSON.stringify(payload, null, 2) }
        };
        if (config.gistId) {
          await (api as GitHubApi).updateGist(config.gistId, SYNC_DESCRIPTION, files);
        } else {
          const gist = await (api as GitHubApi).createGist(SYNC_DESCRIPTION, files, false);
          config.gistId = gist.id;
        }
      } else {
        const content = JSON.stringify({ meta, payload }, null, 2);
        if (config.gistId) {
          await (api as GitLabApi).updateSnippet(config.gistId, SYNC_DESCRIPTION, content, SYNC_SINGLE_FILE);
        } else {
          const snippet = await (api as GitLabApi).createSnippet(
            SYNC_DESCRIPTION,
            content,
            SYNC_SINGLE_FILE
          );
          config.gistId = String(snippet.id);
        }
      }

      config.encryptionKey = password;
      snapshot.localVersion = version;
      snapshot.lastChecksum = checksum;
      snapshot.lastSyncTime = meta.lastSyncTime;
      remoteVersion.value = version;
      remoteChecksum.value = checksum;
      localChecksum.value = checksum;
      statusMessage.value = `已推送到远端（v${version}，共 ${data.length} 条）`;
      persist();
      return meta;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      busy.value = false;
    }
  }

  /** 验证 PAT 是否可用 */
  async function testConnection(): Promise<string> {
    requirePat();
    busy.value = true;
    account.value = '';
    verifying.value = true;
    clearMessages();

    try {
      const api = getApi();
      const login =
        config.provider === 'github'
          ? (await (api as GitHubApi).getUser()).login
          : (await (api as GitLabApi).getUser()).username;
      account.value = login;
      statusMessage.value = `连接成功，已认证为 ${login}`;
      return login;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      verifying.value = false;
      busy.value = false;
    }
  }

  /** 解除与远端的关联（不会删除远端数据） */
  function resetConnection(): void {
    config.gistId = '';
    snapshot.localVersion = 0;
    snapshot.lastSyncTime = 0;
    snapshot.lastChecksum = '';
    remoteVersion.value = 0;
    remoteChecksum.value = '';
    clearMessages();
    persist();
  }

  function init(): void {
    if (initialized.value) return;
    initialized.value = true;

    const totpStore = useTotpStore();

    watch(
      () => totpStore.entries,
      async (entries) => {
        localChecksum.value = await checksumOf(entries);
      },
      { deep: true, immediate: true }
    );

    watch(config, persist, { deep: true });

    let timer: number | undefined;
    watch(
      () => totpStore.entries,
      () => {
        if (
          !config.enabled ||
          !autoPush.value ||
          !config.pat.trim() ||
          !config.gistId ||
          !config.encryptionKey.trim()
        ) {
          return;
        }
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          push().catch(() => undefined);
        }, 2500);
      },
      { deep: true }
    );

    if (config.enabled && config.pat.trim() && config.gistId) {
      checkRemote().catch(() => undefined);
    }
  }

  return {
    config,
    autoPush,
    account,
    verifying,
    localVersion,
    remoteVersion,
    lastSyncTime,
    lastChecksum,
    remoteChecksum,
    localChecksum,
    busy,
    statusMessage,
    errorMessage,
    configured,
    providerLocked,
    hasRemote,
    state,
    stateLabel,
    stateTone,
    stateDescription,
    init,
    setProvider,
    checkRemote,
    pull,
    push,
    testConnection,
    resetConnection,
    clearMessages
  };
});
