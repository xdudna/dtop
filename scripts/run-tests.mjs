import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { build } from 'esbuild';

const outfile = path.resolve('.tmp/totp-tests.mjs');

await mkdir(path.dirname(outfile), { recursive: true });

await build({
  entryPoints: ['tests/totp.test.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile,
  alias: {
    '@': path.resolve('src')
  },
  logLevel: 'warning'
});

await import(pathToFileURL(outfile).href);
