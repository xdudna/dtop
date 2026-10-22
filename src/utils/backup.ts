import type { TotpEntry } from '@/types/totp';

export interface BackupFile {
  app: 'dtop';
  version: number;
  exportedAt: number;
  entries: TotpEntry[];
}

/** 生成导出文件内容（含明文密钥，仅用于本地备份） */
export function createBackup(entries: TotpEntry[]): BackupFile {
  return {
    app: 'dtop',
    version: 1,
    exportedAt: Date.now(),
    entries
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** 从备份文件文本中提取条目数组 */
export function parseBackup(text: string): Array<Partial<TotpEntry>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的 JSON');
  }

  if (Array.isArray(parsed)) return parsed as Array<Partial<TotpEntry>>;

  if (parsed && typeof parsed === 'object') {
    const record = parsed as { entries?: unknown; data?: unknown };
    if (Array.isArray(record.entries)) return record.entries as Array<Partial<TotpEntry>>;
    if (Array.isArray(record.data)) return record.data as Array<Partial<TotpEntry>>;
  }

  throw new Error('备份文件格式不正确，未找到条目数据');
}
