import type { TotpAdvanced } from '@/types/totp';
import { normalizeAdvanced } from '@/types/totp';
import { normalizeBase32 } from '@/utils/base32';

export interface ParsedOtpAuth {
  name: string;
  issuer: string;
  secret: string;
  advanced: TotpAdvanced;
}

/**
 * 解析 otpauth:// URI（扫码/复制来的链接），失败返回 null
 * 支持 otpauth://totp/Issuer:account?secret=...&algorithm=SHA256&digits=8&period=60
 * 以及 otpauth://steam/...
 */
export function parseOtpauthUri(input: string): ParsedOtpAuth | null {
  const value = input.trim();
  if (!/^otpauth:\/\//i.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value.replace(/^otpauth:\/\//i, 'https://'));
  } catch {
    return null;
  }

  const type = url.host.toLowerCase() === 'steam' ? 'STEAM' : 'TOTP';
  const secret = normalizeBase32(url.searchParams.get('secret') ?? '');
  if (!secret) return null;

  const rawLabel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const [labelIssuer, ...rest] = rawLabel.split(':');
  const account = rest.length > 0 ? rest.join(':') : rawLabel;
  const issuer = (url.searchParams.get('issuer') || (rest.length > 0 ? labelIssuer : '')).trim();

  const algorithmParam = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase().replace('-', '');
  const digitsParam = Number(url.searchParams.get('digits') || 6);
  const periodParam = Number(url.searchParams.get('period') || 30);

  return {
    name: account.trim(),
    issuer: issuer || '',
    secret,
    advanced: normalizeAdvanced({
      type,
      algorithm: algorithmParam === 'SHA256' || algorithmParam === 'SHA512' ? algorithmParam : 'SHA1',
      digits: digitsParam === 8 ? 8 : 6,
      period: Number.isFinite(periodParam) ? periodParam : 30
    })
  };
}
