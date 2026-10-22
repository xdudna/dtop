export function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatDateTime(timestamp?: number | null): string {
  if (!timestamp) return '—';
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

export function formatRelativeTime(timestamp?: number | null): string {
  if (!timestamp) return '从未同步';
  const diff = Date.now() - timestamp;
  if (diff < 0) return '刚刚';
  const minute = 60_000;
  if (diff < minute) return '刚刚';
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} 小时前`;
  if (diff < 30 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))} 天前`;
  return formatDate(timestamp);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 密钥脱敏展示：JBSW…K3PX */
export function maskSecret(secret: string): string {
  const value = secret.replace(/\s+/g, '');
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
