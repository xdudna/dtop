/**
 * 同步相关数据模型
 */

export type SyncProvider = 'github' | 'gitlab';

export interface SyncConfig {
  /** 是否启用同步（启用后启动时检查远端、数据变化后自动推送） */
  enabled: boolean;
  /** 同步平台 */
  provider: SyncProvider;
  /** API 基础 URL，留空使用官方地址（支持私有化部署） */
  baseUrl: string;
  /** Personal Access Token */
  pat: string;
  /** Gist / Snippet ID，首次推送后自动创建并回填 */
  gistId: string;
  /** 加密密钥（仅保存在内存中，刷新页面即清除） */
  encryptionKey: string;
}

/** 同步元信息（以明文存放在远端） */
export interface SyncMeta {
  /** 数据版本号 */
  version: number;
  /** 最后同步时间 */
  lastSyncTime: number;
  /** 明文数据的 SHA-256 校验和，用于检测本地/远端变更 */
  checksum: string;
}

/** 加密后的数据文件 */
export interface SyncPayload {
  version: number;
  encryptedData: string;
  iv: string;
  salt: string;
}

/** GitLab Snippet 只有一个文件，把 meta 与 payload 放在一起 */
export interface GitLabSyncDocument {
  meta: SyncMeta;
  payload: SyncPayload;
}

export type SyncState =
  | 'unconfigured'
  | 'no-remote'
  | 'synced'
  | 'local-ahead'
  | 'remote-ahead'
  | 'conflict';

/** 本地同步快照，只持久化非敏感信息 */
export interface SyncSnapshot {
  localVersion: number;
  lastSyncTime: number;
  lastChecksum: string;
}
