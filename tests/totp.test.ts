import assert from 'node:assert/strict';

import { decryptData, encryptData } from '@/crypto/encrypt';
import { formatTotpCode, generateSteamTotp, generateTotp, hotp } from '@/crypto/totp';
import { normalizeAdvanced } from '@/types/totp';
import type { HashAlgorithm } from '@/types/totp';
import { base32Decode, base32Encode, isValidBase32, normalizeBase32 } from '@/utils/base32';
import { parseOtpauthUri } from '@/utils/otpauth';

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } catch (error) {
    console.error(`  \u2717 ${name}`);
    throw error;
  }
}

function secretOf(text: string): string {
  return base32Encode(new TextEncoder().encode(text));
}

/* -------------------- Base32 -------------------- */

await test('Base32 解码已知密钥', () => {
  const bytes = base32Decode('JBSWY3DPEHPK3PXP');
  assert.deepEqual(
    Array.from(bytes),
    [72, 101, 108, 108, 111, 33, 222, 173, 190, 239]
  );
});

await test('Base32 编解码可逆', () => {
  const source = crypto.getRandomValues(new Uint8Array(20));
  const encoded = base32Encode(source);
  assert.deepEqual(Array.from(base32Decode(encoded)), Array.from(source));
});

await test('Base32 规范化与校验', () => {
  assert.equal(normalizeBase32('jbsw y3dp-ehpk3pxp=='), 'JBSWY3DPEHPK3PXP');
  assert.equal(isValidBase32('JBSWY3DP'), true);
  assert.equal(isValidBase32('JBSWY3D1'), false);
  assert.equal(isValidBase32('!@#$'), false);
});

/* -------------------- RFC 6238 测试向量 -------------------- */

const RFC_CASES: Array<{
  algorithm: HashAlgorithm;
  secretText: string;
  vectors: Array<{ time: number; code: string }>;
}> = [
  {
    algorithm: 'SHA1',
    secretText: '12345678901234567890',
    vectors: [
      { time: 59, code: '94287082' },
      { time: 1111111109, code: '07081804' },
      { time: 1111111111, code: '14050471' },
      { time: 1234567890, code: '89005924' },
      { time: 2000000000, code: '69279037' },
      { time: 20000000000, code: '65353130' }
    ]
  },
  {
    algorithm: 'SHA256',
    secretText: '12345678901234567890123456789012',
    vectors: [
      { time: 59, code: '46119246' },
      { time: 1111111109, code: '68084774' },
      { time: 1111111111, code: '67062674' },
      { time: 1234567890, code: '91819424' },
      { time: 2000000000, code: '90698825' },
      { time: 20000000000, code: '77737706' }
    ]
  },
  {
    algorithm: 'SHA512',
    secretText: '1234567890123456789012345678901234567890123456789012345678901234',
    vectors: [
      { time: 59, code: '90693936' },
      { time: 1111111109, code: '25091201' },
      { time: 1111111111, code: '99943326' },
      { time: 1234567890, code: '93441116' },
      { time: 2000000000, code: '38618901' },
      { time: 20000000000, code: '47863826' }
    ]
  }
];

for (const testCase of RFC_CASES) {
  await test(`RFC 6238 向量（${testCase.algorithm}）`, async () => {
    const secret = secretOf(testCase.secretText);
    for (const vector of testCase.vectors) {
      const counter = Math.floor(vector.time / 30);
      const code = await hotp(secret, counter, 8, testCase.algorithm);
      assert.equal(code, vector.code, `T=${vector.time} 期望 ${vector.code}，实际 ${code}`);
    }
  });
}

/* -------------------- TOTP / Steam -------------------- */

await test('generateTotp 使用 30 秒周期与 6 位数字', async () => {
  const secret = secretOf('12345678901234567890');
  const timestamp = 1_111_111_109_000;
  const code = await generateTotp(secret, normalizeAdvanced({ period: 30, digits: 6 }), timestamp);
  assert.equal(code, '081804');
  assert.match(code, /^\d{6}$/);
});

await test('generateTotp 支持自定义周期与 8 位', async () => {
  const secret = secretOf('12345678901234567890');
  const code = await generateTotp(
    secret,
    normalizeAdvanced({ period: 60, digits: 8, algorithm: 'SHA256' }),
    1_111_111_109_000
  );
  assert.match(code, /^\d{8}$/);
});

await test('Steam Guard 输出 5 位合法字符', async () => {
  const secret = secretOf('12345678901234567890');
  const timestamp = 1_700_000_000_000;
  const code = await generateSteamTotp(secret, timestamp);
  assert.equal(code.length, 5);
  assert.match(code, /^[23456789BCDFGHJKMNPQRTVWXY]{5}$/);
  assert.equal(code, await generateSteamTotp(secret, timestamp));
  assert.notEqual(code, await generateSteamTotp(secret, timestamp + 30_000));
});

await test('无效密钥抛出错误', async () => {
  await assert.rejects(() => generateTotp('!!invalid!!', normalizeAdvanced()), /Base32/);
});

await test('验证码展示格式化', () => {
  assert.equal(formatTotpCode('123456'), '123 456');
  assert.equal(formatTotpCode('12345678'), '1234 5678');
  assert.equal(formatTotpCode('ABCDE'), 'ABCDE');
});

/* -------------------- 加密 -------------------- */

await test('AES-GCM 加密后可解密', async () => {
  const plaintext = JSON.stringify([{ name: 'GitHub', secret: 'JBSWY3DPEHPK3PXP' }]);
  const encrypted = await encryptData(plaintext, 'correct horse battery staple');

  assert.notEqual(encrypted.encryptedData, plaintext);
  assert.ok(encrypted.iv.length > 0);
  assert.ok(encrypted.salt.length > 0);

  const decrypted = await decryptData(
    encrypted.encryptedData,
    encrypted.iv,
    encrypted.salt,
    'correct horse battery staple'
  );
  assert.equal(decrypted, plaintext);
});

await test('错误密钥无法解密', async () => {
  const encrypted = await encryptData('top secret', 'right-password');
  await assert.rejects(
    () => decryptData(encrypted.encryptedData, encrypted.iv, encrypted.salt, 'wrong-password'),
    /解密失败/
  );
});

await test('每次加密使用不同的盐和 IV', async () => {
  const first = await encryptData('same data', 'same-password');
  const second = await encryptData('same data', 'same-password');
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.encryptedData, second.encryptedData);
});

/* -------------------- otpauth 解析 -------------------- */

await test('解析标准 otpauth URI', () => {
  const parsed = parseOtpauthUri(
    'otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA256&digits=8&period=60'
  );

  assert.ok(parsed);
  assert.equal(parsed.name, 'alice');
  assert.equal(parsed.issuer, 'GitHub');
  assert.equal(parsed.secret, 'JBSWY3DPEHPK3PXP');
  assert.deepEqual(parsed.advanced, {
    type: 'TOTP',
    algorithm: 'SHA256',
    period: 60,
    digits: 8
  });
});

await test('解析 Steam URI 与缺省参数', () => {
  const parsed = parseOtpauthUri('otpauth://steam/Steam:player?secret=JBSWY3DP');
  assert.ok(parsed);
  assert.equal(parsed.advanced.type, 'STEAM');
  assert.equal(parsed.advanced.period, 30);
  assert.equal(parsed.advanced.digits, 6);
  assert.equal(parsed.name, 'player');
});

await test('非 otpauth 输入返回 null', () => {
  assert.equal(parseOtpauthUri('JBSWY3DPEHPK3PXP'), null);
  assert.equal(parseOtpauthUri('https://example.com'), null);
});

/* -------------------- 高级设置规范化 -------------------- */

await test('高级设置规范化非法值', () => {
  assert.deepEqual(normalizeAdvanced({ type: 'STEAM', algorithm: 'MD5' as HashAlgorithm, period: 5, digits: 9 }), {
    type: 'STEAM',
    algorithm: 'SHA1',
    period: 30,
    digits: 6
  });
  assert.deepEqual(normalizeAdvanced({ period: 60, digits: 8 }), {
    type: 'TOTP',
    algorithm: 'SHA1',
    period: 60,
    digits: 8
  });
});

console.log(`\n${passed} 项测试全部通过`);
