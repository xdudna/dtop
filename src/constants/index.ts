export const APP_NAME = 'dtop';
export const APP_VERSION = '1.0.0';
export const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'dtop · TOTP 验证器';

/** 响应式断点：小于该宽度使用移动端 UI */
export const BREAKPOINT = 768;

/** 同步文件 */
export const SYNC_DESCRIPTION = 'dtop TOTP - Encrypted Data';
export const SYNC_META_FILE = 'totp-meta.json';
export const SYNC_DATA_FILE = 'totp-data.json';
export const SYNC_SINGLE_FILE = 'dtop-sync.json';

export const STORAGE_KEYS = {
  settings: 'dtop:settings',
  syncConfig: 'dtop:sync-config',
  syncSnapshot: 'dtop:sync-snapshot',
  entriesFallback: 'dtop:entries-fallback'
} as const;

export const ERROR_CODES = {
  SYNC_NETWORK_ERROR: 'SYNC_001',
  SYNC_AUTH_FAILED: 'SYNC_002',
  SYNC_GIST_NOT_FOUND: 'SYNC_003',
  SYNC_DECRYPT_FAILED: 'SYNC_004',
  SYNC_VERSION_MISMATCH: 'SYNC_005',
  DATA_INVALID_FORMAT: 'DATA_001',
  DATA_ENCRYPT_FAILED: 'DATA_002',
  DATA_DECRYPT_FAILED: 'DATA_003',
  VALIDATION_SECRET_INVALID: 'VALID_001',
  VALIDATION_PERIOD_INVALID: 'VALID_002',
  VALIDATION_DIGITS_INVALID: 'VALID_003'
} as const;
