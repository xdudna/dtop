const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** 去掉空格、连字符、末尾补位符并转大写 */
export function normalizeBase32(input: string): string {
  return input.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase();
}

export function isValidBase32(input: string): boolean {
  const value = normalizeBase32(input);
  return value.length > 0 && /^[A-Z2-7]+$/.test(value);
}

export function base32Decode(input: string): Uint8Array {
  const cleanInput = normalizeBase32(input);
  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;

  for (const char of cleanInput) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`密钥包含非 Base32 字符：${char}`);
    }

    buffer = (buffer << 5) | index;
    bitsLeft += 5;

    if (bitsLeft >= 8) {
      bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }

  return new Uint8Array(bytes);
}

export function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }

  while (output.length % 8 !== 0) {
    output += '=';
  }

  return output;
}
