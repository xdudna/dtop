import { STEAM_PERIOD } from '@/types/totp';
import type { HashAlgorithm, TotpAdvanced } from '@/types/totp';
import { base32Decode } from '@/utils/base32';

/** Web Crypto 要求的算法名（TOTP 数据模型里存的是 SHA1 / SHA256 / SHA512） */
const HASH_NAME: Record<HashAlgorithm, string> = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA512: 'SHA-512'
};

export const STEAM_CHARSET = '23456789BCDFGHJKMNPQRTVWXY';

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
}

function counterToBuffer(counter: number): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  const high = Math.floor(counter / 0x1_0000_0000);
  const low = counter >>> 0;
  view.setUint32(0, high, false);
  view.setUint32(4, low, false);
  return buffer;
}

async function hmac(secret: string, counter: number, algorithm: HashAlgorithm): Promise<Uint8Array> {
  const keyBytes = base32Decode(secret);
  if (keyBytes.length === 0) {
    throw new Error('密钥为空或不是有效的 Base32');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    { name: 'HMAC', hash: HASH_NAME[algorithm] },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterToBuffer(counter));
  return new Uint8Array(signature);
}

/** 动态截断（RFC 4226 §5.3） */
function truncate(hmacValue: Uint8Array): number {
  const offset = hmacValue[hmacValue.length - 1] & 0x0f;
  return (
    ((hmacValue[offset] & 0x7f) << 24) |
    ((hmacValue[offset + 1] & 0xff) << 16) |
    ((hmacValue[offset + 2] & 0xff) << 8) |
    (hmacValue[offset + 3] & 0xff)
  );
}

/** HOTP：基于计数器的验证码 */
export async function hotp(
  secret: string,
  counter: number,
  digits: number,
  algorithm: HashAlgorithm = 'SHA1'
): Promise<string> {
  const hmacValue = await hmac(secret, counter, algorithm);
  const binary = truncate(hmacValue);
  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}

export function getTotpCounter(period: number, timestamp: number = Date.now()): number {
  return Math.floor(timestamp / 1000 / period);
}

export function getRemainingSeconds(period: number, timestamp: number = Date.now()): number {
  const safePeriod = Math.max(1, period);
  return safePeriod - (Math.floor(timestamp / 1000) % safePeriod);
}

/** 标准 TOTP（RFC 6238），支持 TOTP / Steam 两种类型 */
export async function generateTotp(
  secret: string,
  options: TotpAdvanced,
  timestamp: number = Date.now()
): Promise<string> {
  if (options.type === 'STEAM') {
    return generateSteamTotp(secret, timestamp);
  }
  const period = Math.max(1, options.period);
  const counter = getTotpCounter(period, timestamp);
  return hotp(secret, counter, options.digits, options.algorithm);
}

/** Steam Guard 验证码：30 秒、5 位自定义字符集 */
export async function generateSteamTotp(secret: string, timestamp: number = Date.now()): Promise<string> {
  const counter = getTotpCounter(STEAM_PERIOD, timestamp);
  const hmacValue = await hmac(secret, counter, 'SHA1');
  let fullCode = truncate(hmacValue);
  let code = '';

  for (let i = 0; i < 5; i++) {
    code += STEAM_CHARSET[fullCode % STEAM_CHARSET.length];
    fullCode = Math.floor(fullCode / STEAM_CHARSET.length);
  }

  return code;
}

/** 展示用格式化：123 456 / 1234 5678 */
export function formatTotpCode(code: string): string {
  if (!code) return '• • •';
  if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
  if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
  return code;
}
