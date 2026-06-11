import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const viewerRoot = path.join(repoRoot, 'viewer');
const indexPath = path.join(viewerRoot, 'index.html');

const indexHtml = fs.readFileSync(indexPath, 'utf8');
const moduleScripts = [...indexHtml.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/gi)]
  .map((match) => match[1])
  .filter(Boolean);

assert.ok(moduleScripts.length > 0, 'viewer/index.html must declare at least one module script entrypoint');

for (const scriptSrc of moduleScripts) {
  assert.ok(!/^https?:\/\//i.test(scriptSrc), `module script must be local for deploy preflight: ${scriptSrc}`);

  const normalizedSrc = scriptSrc.split('?')[0].split('#')[0];
  const resolved = path.resolve(viewerRoot, normalizedSrc);

  assert.ok(
    resolved.startsWith(viewerRoot + path.sep),
    `module script must stay inside viewer artifact: ${scriptSrc}`,
  );

  assert.ok(fs.existsSync(resolved), `module script referenced by viewer/index.html does not exist: ${scriptSrc}`);
  assert.ok(fs.statSync(resolved).isFile(), `module script is not a file: ${scriptSrc}`);
}

console.log(`Verified ${moduleScripts.length} viewer module entrypoint(s).`);
