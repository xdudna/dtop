/** 生成唯一 ID，兼容不支持 randomUUID 的浏览器 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const random = crypto.getRandomValues(new Uint8Array(16));
  let id = '';
  for (const byte of random) {
    id += byte.toString(16).padStart(2, '0');
  }
  return `${Date.now().toString(36)}-${id}`;
}

/** 生成随机 Base32 密钥（默认 32 字符 = 160 bit） */
export function createRandomSecret(length = 32): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let secret = '';
  for (const byte of bytes) {
    secret += alphabet[byte % alphabet.length];
  }
  return secret;
}
