import { base64ToBytes, bytesToBase64 } from '@/utils/base64';

/** PBKDF2 迭代次数（OWASP 推荐量级，约 0.1s/次） */
const PBKDF2_ITERATIONS = 100_000;

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  salt: string;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** AES-GCM 256 + PBKDF2(100000, SHA-256) 加密 */
export async function encryptData(data: string, password: string): Promise<EncryptionResult> {
  if (!password) {
    throw new Error('加密密钥不能为空');
  }

  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoder.encode(data)
  );

  return {
    encryptedData: bytesToBase64(new Uint8Array(encryptedBuffer)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt)
  };
}

export async function decryptData(
  encryptedData: string,
  iv: string,
  salt: string,
  password: string
): Promise<string> {
  if (!password) {
    throw new Error('解密密钥不能为空');
  }

  const saltBytes = base64ToBytes(salt);
  const ivBytes = base64ToBytes(iv);
  const encryptedBytes = base64ToBytes(encryptedData);
  const key = await deriveKey(password, saltBytes);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes as BufferSource },
      key,
      encryptedBytes as BufferSource
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error('解密失败：加密密钥不正确，或远端数据已损坏');
  }
}
