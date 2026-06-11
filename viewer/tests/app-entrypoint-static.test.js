import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const viewerRoot = path.join(repoRoot, 'viewer');
const indexPath = path.join(viewerRoot, 'index.html');
const runtimeEventsPath = path.join(viewerRoot, 'contracts/runtime-events.js');

function stripUrlSuffix(value) {
  return String(value || '').split('?')[0].split('#')[0];
}

function isExternalOrBareImport(value) {
  const text = String(value || '').trim();
  return /^https?:\/\//i.test(text) || /^(data|blob):/i.test(text) || (!text.startsWith('./') && !text.startsWith('../') && !text.startsWith('/'));
}

function resolveViewerAsset(fromDir, assetRef) {
  const cleanRef = stripUrlSuffix(assetRef);
  if (!cleanRef) return null;
  if (/^https?:\/\//i.test(cleanRef) || /^(data|blob):/i.test(cleanRef)) return null;

  const resolved = cleanRef.startsWith('/')
    ? path.resolve(viewerRoot, `.${cleanRef}`)
    : path.resolve(fromDir, cleanRef);

  assert.ok(
    resolved === viewerRoot || resolved.startsWith(viewerRoot + path.sep),
    `asset must stay inside viewer artifact: ${assetRef}`,
  );

  return resolved;
}

function resolveViewerRuntimeFetchAsset(assetRef) {
  const cleanRef = stripUrlSuffix(assetRef);
  if (!cleanRef) return null;
  assert.ok(
    !cleanRef.startsWith('../'),
    `runtime fetch asset must not escape deployed viewer root: ${assetRef}`,
  );
  return resolveViewerAsset(viewerRoot, cleanRef);
}

function assertFileExists(resolved, label) {
  assert.ok(fs.existsSync(resolved), `${label} does not exist: ${path.relative(viewerRoot, resolved)}`);
  assert.ok(fs.statSync(resolved).isFile(), `${label} is not a file: ${path.relative(viewerRoot, resolved)}`);
}

function extractHtmlRefs(indexHtml, tagName, attrName, filter = () => true) {
  const refs = [];
  const tagRegex = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  const attrRegex = new RegExp(`${attrName}=["']([^"']+)["']`, 'i');

  for (const tagMatch of indexHtml.matchAll(tagRegex)) {
    const tag = tagMatch[0];
    if (!filter(tag)) continue;
    const attrMatch = tag.match(attrRegex);
    if (attrMatch?.[1]) refs.push(attrMatch[1]);
  }

  return refs;
}

function extractLocalJsImports(sourceText) {
  const imports = new Set();
  const patterns = [
    /import\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /export\s+(?:[^'";]+?\s+from\s+)["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) {
      const specifier = match[1];
      if (!isExternalOrBareImport(specifier)) imports.add(specifier);
    }
  }

  return [...imports];
}

function verifyModuleGraph(entryFiles) {
  const visited = new Set();
  const stack = [...entryFiles];

  while (stack.length) {
    const file = stack.pop();
    const key = path.resolve(file);
    if (visited.has(key)) continue;
    visited.add(key);

    assertFileExists(key, 'module');
    const text = fs.readFileSync(key, 'utf8');
    const fromDir = path.dirname(key);

    for (const specifier of extractLocalJsImports(text)) {
      const resolved = resolveViewerAsset(fromDir, specifier);
      if (!resolved) continue;
      assertFileExists(resolved, `module import ${specifier}`);
      stack.push(resolved);
    }
  }

  return visited;
}

function readRuntimeEventKeys() {
  const text = fs.readFileSync(runtimeEventsPath, 'utf8');
  const match = text.match(/RuntimeEvents\s*=\s*Object\.freeze\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  assert.ok(match, 'RuntimeEvents object must be statically parseable');

  const keys = new Set();
  for (const keyMatch of match[1].matchAll(/\b([A-Z][A-Z0-9_]*)\s*:/g)) {
    keys.add(keyMatch[1]);
  }
  assert.ok(keys.size > 0, 'RuntimeEvents object must define at least one event');
  return keys;
}

function verifyRuntimeEventReferences(moduleFiles) {
  const validKeys = readRuntimeEventKeys();
  const missing = [];

  for (const file of moduleFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const ref of text.matchAll(/RuntimeEvents\.([A-Z][A-Z0-9_]*)/g)) {
      const key = ref[1];
      if (!validKeys.has(key)) {
        missing.push(`${path.relative(viewerRoot, file)} -> RuntimeEvents.${key}`);
      }
    }
  }

  assert.deepEqual(missing, [], `RuntimeEvents references must be registered:\n${missing.join('\n')}`);
}

function verifyRuntimeFetchAssets(moduleFiles) {
  const missing = [];

  for (const file of moduleFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/const\s+([A-Z0-9_]*URL)\s*=\s*["']([^"']+)["']/g)) {
      const name = match[1];
      const assetRef = match[2];
      if (!assetRef.includes('/')) continue;
      if (/^https?:\/\//i.test(assetRef)) continue;

      try {
        const resolved = resolveViewerRuntimeFetchAsset(assetRef);
        if (resolved) assertFileExists(resolved, `${name} runtime fetch asset`);
      } catch (error) {
        missing.push(`${path.relative(viewerRoot, file)} ${name}=${assetRef}: ${error.message}`);
      }
    }
  }

  assert.deepEqual(missing, [], `runtime fetch assets must exist inside deployed viewer root:\n${missing.join('\n')}`);
}

const indexHtml = fs.readFileSync(indexPath, 'utf8');
const moduleScripts = extractHtmlRefs(indexHtml, 'script', 'src', (tag) => /type=["']module["']/i.test(tag));
const stylesheets = extractHtmlRefs(indexHtml, 'link', 'href', (tag) => /rel=["']stylesheet["']/i.test(tag));

assert.ok(moduleScripts.length > 0, 'viewer/index.html must declare at least one module script entrypoint');

const entryFiles = [];
for (const scriptSrc of moduleScripts) {
  assert.ok(!/^https?:\/\//i.test(scriptSrc), `module script must be local for deploy preflight: ${scriptSrc}`);
  const resolved = resolveViewerAsset(viewerRoot, scriptSrc);
  assertFileExists(resolved, `module script referenced by viewer/index.html: ${scriptSrc}`);
  entryFiles.push(resolved);
}

for (const href of stylesheets) {
  const resolved = resolveViewerAsset(viewerRoot, href);
  if (!resolved) continue;
  assertFileExists(resolved, `stylesheet referenced by viewer/index.html: ${href}`);
}

const checkedModules = verifyModuleGraph(entryFiles);
verifyRuntimeEventReferences(checkedModules);
verifyRuntimeFetchAssets(checkedModules);
console.log(`Verified ${moduleScripts.length} viewer module entrypoint(s), ${stylesheets.length} stylesheet(s), ${checkedModules.size} local module file(s), runtime events, and runtime fetch assets.`);
