/**
 * TOTP 条目数据模型
 */

export type TotpType = 'TOTP' | 'STEAM';

export type HashAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface TotpAdvanced {
  /** 验证码类型：标准 TOTP 或 Steam Guard */
  type: TotpType;
  /** HMAC 哈希算法 */
  algorithm: HashAlgorithm;
  /** 刷新间隔（秒） */
  period: number;
  /** 验证码位数 */
  digits: number;
}

export interface TotpEntry {
  /** 唯一 ID */
  id: string;
  /** 名称（账号） */
  name: string;
  /** 服务商 */
  issuer: string;
  /** 分组，空字符串归入「默认」分组 */
  group: string;
  /** 备注 */
  note: string;
  /** Base32 编码的密钥 */
  secret: string;
  /** 高级设置 */
  advanced: TotpAdvanced;
  /** 创建时间戳（毫秒） */
  createdAt: number;
  /** 更新时间戳（毫秒） */
  updatedAt: number;
  /** 排序序号 */
  order: number;
}

export const DEFAULT_GROUP = '默认';

export const DEFAULT_ADVANCED: TotpAdvanced = {
  type: 'TOTP',
  algorithm: 'SHA1',
  period: 30,
  digits: 6
};

export const TOTP_TYPES: TotpType[] = ['TOTP', 'STEAM'];

export const HASH_ALGORITHMS: HashAlgorithm[] = ['SHA1', 'SHA256', 'SHA512'];

/** Steam Guard 固定 30 秒、5 位字符 */
export const STEAM_PERIOD = 30;
export const STEAM_DIGITS = 5;

export function createAdvanced(patch: Partial<TotpAdvanced> = {}): TotpAdvanced {
  return { ...DEFAULT_ADVANCED, ...patch };
}

/** 规范化高级设置，兼容导入/同步来的脏数据 */
export function normalizeAdvanced(input?: Partial<TotpAdvanced> | null): TotpAdvanced {
  const type: TotpType = input?.type === 'STEAM' ? 'STEAM' : 'TOTP';
  const algorithm: HashAlgorithm = HASH_ALGORITHMS.includes(input?.algorithm as HashAlgorithm)
    ? (input?.algorithm as HashAlgorithm)
    : DEFAULT_ADVANCED.algorithm;
  const rawPeriod = Number(input?.period);
  const period =
    Number.isFinite(rawPeriod) && rawPeriod >= 10 && rawPeriod <= 300
      ? Math.round(rawPeriod)
      : DEFAULT_ADVANCED.period;
  const rawDigits = Number(input?.digits);
  const digits = rawDigits === 8 ? 8 : 6;

  return { type, algorithm, period, digits };
}
