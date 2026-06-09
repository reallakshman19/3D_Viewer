#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path.cwd()

def p(rel: str) -> Path:
    return ROOT / rel

def read(rel: str) -> str:
    return p(rel).read_text(encoding="utf-8")

def write(rel: str, text: str) -> None:
    p(rel).write_text(text, encoding="utf-8")

def replace_regex_once(text: str, pattern: str, repl: str, label: str, flags=re.S) -> str:
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise RuntimeError(f"Expected one replacement for {label}, got {n}")
    return out

# 1) legacy-adapter.js robust Weight Match fix
legacy_path = "viewer/tabs/model-converters/legacy-adapter.js"
legacy = read(legacy_path)

old_import = "import { findWeightMasterMatch, collectXmlCiiZeroRigidWeightIssues, applyXmlCiiRigidWeightOverrides, xmlCiiForwardElementLengths } from '../../converters/xml-cii2019-core/weight-match-model.js';"
new_import = """import {
  findWeightMasterMatch,
  collectXmlCiiZeroRigidWeightIssues,
  applyXmlCiiRigidWeightOverrides,
  xmlCiiForwardElementLengths,
  xmlCiiRigidWeightOverrideKey,
  isXmlCiiRigidNode,
  xmlCiiNumberText,
  xmlCiiRigidWeightOverrideForNode,
  xmlCiiAncestorBranchName,
  scoreXmlCiiWeightCandidates,
  buildStagedComponentIndex,
  stagedComponentForXmlNode,
} from '../../converters/xml-cii2019-core/weight-match-model.js';"""
if old_import in legacy:
    legacy = legacy.replace(old_import, new_import, 1)

legacy = re.sub(
    r"\nif \(typeof globalThis !== 'undefined' && !globalThis\\.isXmlCiiRigidNode\) \{\n\s*Object\\.defineProperty\(globalThis, 'isXmlCiiRigidNode', \{\n\s*value: _isXmlCiiRigidNode,\n\s*configurable: true,\n\s*\}\);\n\}\n",
    "\n",
    legacy,
    count=1,
)

wrapper_anchor = """function _xmlCiiForwardElementLengths(nodes) {
  return xmlCiiForwardElementLengths(nodes);
}
"""
extra_wrappers = """
function _xmlCiiAncestorBranchName(node) {
  return xmlCiiAncestorBranchName(node);
}

function _scoreXmlCiiWeightCandidates({ boreMm, rating, lengthMm }, config) {
  return scoreXmlCiiWeightCandidates({ boreMm, rating, lengthMm }, config);
}

function _buildStagedComponentIndex(stagedJsonText, config) {
  return buildStagedComponentIndex(stagedJsonText, config);
}

function _stagedComponentForXmlNode(node, stagedIndex, config) {
  return stagedComponentForXmlNode(node, stagedIndex, config);
}
"""
if "function _xmlCiiAncestorBranchName(node)" not in legacy and wrapper_anchor in legacy:
    legacy = legacy.replace(wrapper_anchor, wrapper_anchor + extra_wrappers, 1)

legacy = replace_regex_once(
    legacy,
    r"function _collectXmlCiiZeroRigidWeightIssues\(xmlText, stagedJsonText, config\) \{\n[\s\S]*?\n\}\n\nfunction _applyXmlCiiRigidWeightOverrides",
    """function _collectXmlCiiZeroRigidWeightIssues(xmlText, stagedJsonText, config) {
  return collectXmlCiiZeroRigidWeightIssues(xmlText, stagedJsonText, config);
}

function _applyXmlCiiRigidWeightOverrides""",
    "collector delegate",
)
write(legacy_path, legacy)

# 2) config defaults
config_path = "viewer/converters/xml-cii2019-core/config.js"
cfg = read(config_path)
if "processDefaults:" not in cfg:
    cfg = cfg.replace(
        "defaultFriction: '0.3',",
        """defaultFriction: '0.3',
    defaultWallThickness: 0,
    defaultCorrosionAllowance: 0,
    processDefaults: { p1: '700', t1: '120', t2: '309', t3: '-5', density: '100' },""",
        1,
    )
if "processDefaults: { ...defaults.processDefaults" not in cfg:
    cfg = cfg.replace(
        "material: { ...defaults.material, ...(parsed.material || {}) },",
        "material: { ...defaults.material, ...(parsed.material || {}) },\n      processDefaults: { ...defaults.processDefaults, ...(parsed.processDefaults || {}) },",
        1,
    )
write(config_path, cfg)

# 3) Wall thickness exact saved/mapped row read + config default
branch_path = "viewer/converters/xml-cii2019-core/branch-process-resolver.js"
branch = read(branch_path)
branch = branch.replace(
    "pipingClassRow?.['Wall Thickness'] ??\n    pipingClassRow?.WALL_THICKNESS ??",
    "pipingClassRow?.['Wall Thickness'] ??\n    pipingClassRow?.['Wall thickness'] ??\n    pipingClassRow?.WALL_THICKNESS ??",
    1,
)
branch = branch.replace(
    "const fromXml = toFiniteNumber(xmlNode?.wallThickness ?? xmlNode?.WallThickness ?? xmlBranch?.wallThickness);\n  if (fromXml != null) return { valueMm: fromXml, source: 'xml-fallback' };\n  return { valueMm: 0, source: 'default-zero' };",
    "const fromXml = toFiniteNumber(xmlNode?.wallThickness ?? xmlNode?.WallThickness ?? xmlBranch?.wallThickness);\n  if (fromXml != null) return { valueMm: fromXml, source: 'xml-fallback' };\n  const fromConfig = toFiniteNumber(config.defaultWallThickness);\n  return { valueMm: fromConfig ?? 0, source: fromConfig != null ? 'config-default' : 'default-zero' };",
    1,
)
write(branch_path, branch)

# 4) Autoload message and wall thickness normalization
for autoload_path in ["viewer/tabs/xml-cii-master-autoload.js", "viewer/tabs/xml-cii-master-autoload-patch.js"]:
    if not p(autoload_path).exists():
        continue
    autoload = read(autoload_path)
    autoload = autoload.replace(
        "wallThickness: rawValue(row, ['wallThickness', 'Wall Thickness', 'WALL_THICKNESS', 'WT', 'WallThickness']),",
        "wallThickness: rawValue(row, ['wallThickness', 'Wall Thickness', 'Wall thickness', 'WALL_THICKNESS', 'WT', 'WallThickness']),",
    )
    autoload = autoload.replace(
        "Piping Class: waiting for XML input; use Rescan XML after selecting XML.",
        "Piping Class: select XML, then Rescan XML to load spec wise shard rows.",
    )
    write(autoload_path, autoload)

# 5) Preview default-value handling
preview_path = "viewer/tabs/model-converters/converters/xmltocii2019_helper/preview-renderer.js"
preview = read(preview_path)
preview = preview.replace(
    "function _xmlCiiProcessValue(pdOverride, row, overrideKey, rowKeys) { return pdOverride && Object.prototype.hasOwnProperty.call(pdOverride, overrideKey) ? _toText(pdOverride[overrideKey]).trim() : _rowText(row, rowKeys); }",
    """function _processDefaultValue(config, fieldKey) {
  const defaults = config?.processDefaults && typeof config.processDefaults === 'object' ? config.processDefaults : {};
  return _toText(defaults[fieldKey]).trim();
}
function _xmlCiiProcessValue(pdOverride, row, overrideKey, rowKeys, config) {
  if (pdOverride && Object.prototype.hasOwnProperty.call(pdOverride, overrideKey)) return _toText(pdOverride[overrideKey]).trim();
  const rowVal = _rowText(row, rowKeys);
  if (rowVal) return rowVal;
  return _processDefaultValue(config, overrideKey);
}
function _xmlCiiProcessSource(pdOverride, row, overrideKey, rowKeys, config) {
  if (pdOverride && Object.prototype.hasOwnProperty.call(pdOverride, overrideKey)) return 'override';
  if (_rowText(row, rowKeys)) return 'linelist';
  return _processDefaultValue(config, overrideKey) ? 'default' : 'none';
}""",
    1,
)

preview = preview.replace("const p1 = _xmlCiiProcessValue(pdOverride, lineListMatch, 'p1', ['p1']);", "const p1 = _xmlCiiProcessValue(pdOverride, lineListMatch, 'p1', ['p1'], config);")
preview = preview.replace("const t1 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't1', ['t1']);", "const t1 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't1', ['t1'], config);")
preview = preview.replace("const t2 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't2', ['t2']);", "const t2 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't2', ['t2'], config);")
preview = preview.replace("const t3 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't3', ['t3']);", "const t3 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't3', ['t3'], config);")
preview = preview.replace("const density = _xmlCiiProcessValue(pdOverride, lineListMatch, 'density', ['density']);", "const density = _xmlCiiProcessValue(pdOverride, lineListMatch, 'density', ['density'], config);")

preview = preview.replace(
    "p1Source: _hasOwn(pdOverride, 'p1') ? 'override' : (p1 ? 'linelist' : 'none'),\n      t1Source: _hasOwn(pdOverride, 't1') ? 'override' : (t1 ? 'linelist' : 'none'),\n      t2Source: _hasOwn(pdOverride, 't2') ? 'override' : (t2 ? 'linelist' : 'none'),\n      t3Source: _hasOwn(pdOverride, 't3') ? 'override' : (t3 ? 'linelist' : 'none'),\n      densitySource: _hasOwn(pdOverride, 'density') ? 'override' : (density ? 'linelist' : 'none'),",
    "p1Source: _xmlCiiProcessSource(pdOverride, lineListMatch, 'p1', ['p1'], config),\n      t1Source: _xmlCiiProcessSource(pdOverride, lineListMatch, 't1', ['t1'], config),\n      t2Source: _xmlCiiProcessSource(pdOverride, lineListMatch, 't2', ['t2'], config),\n      t3Source: _xmlCiiProcessSource(pdOverride, lineListMatch, 't3', ['t3'], config),\n      densitySource: _xmlCiiProcessSource(pdOverride, lineListMatch, 'density', ['density'], config),",
    1,
)

preview = re.sub(
    r"processInputHtmlRenderer: \(fieldKey, lineKey, val, src, ri\) => `.*?`,",
    """processInputHtmlRenderer: (fieldKey, lineKey, val, src, ri) => {
      const cls = src === 'override' ? 'mc-preview-pd-cell mc-preview-pd-override' : (src === 'linelist' ? 'mc-preview-pd-cell mc-preview-pd-linelist' : (src === 'default' ? 'mc-preview-pd-cell mc-preview-pd-default' : 'mc-preview-pd-cell mc-preview-pd-empty'));
      const style = src === 'default' ? 'style="color:#7f1d1d;font-weight:600;font-style:italic;" title="Config default value — click Review defaults to edit line-specific values"' : '';
      return `↓`;
    },""",
    preview,
    count=1,
    flags=re.S,
)

review_block = r"""
  const defaultFields = ['p1', 't1', 't2', 't3', 'density', 'wallThickness', 'corrosion'];
  const defaultRows = branchRows
    .map((row, ri) => ({ row, ri, fields: defaultFields.filter((field) => row[`${field}Source`] === 'default' || row[`${field}Source`] === 'config-default' || row[`${field}Source`] === 'default-zero') }))
    .filter((item) => item.fields.length > 0);
  if (defaultRows.length) {
    host.insertAdjacentHTML('afterbegin', `Review defaults (${defaultRows.length} line${defaultRows.length === 1 ? '' : 's'}) Config default values are shown in dark red.`);
    host.querySelector('#mc-review-default-values')?.addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:5vh 5vw;z-index:9999;background:#0f1724;color:#e6edf5;border:1px solid #31455f;border-radius:10px;padding:14px;overflow:auto;box-shadow:0 20px 80px rgba(0,0,0,.45);';
      modal.innerHTML = `
        
          Lines using config defaults
          Close
        
        Edit values below to create line-specific overrides. Blank fields stay as defaults.
        
          BranchLine Key${defaultFields.map((f) => `${_esc(f)}`).join('')}
          
            ${defaultRows.map(({ row, ri }) => `
              ${_esc(row.branchName)}
              ${_esc(row.lineKey)}
              ${defaultFields.map((field) => {
                const isDefault = row[`${field}Source`] === 'default' || row[`${field}Source`] === 'config-default' || row[`${field}Source`] === 'default-zero';
                return ``;
              }).join('')}
            `).join('')}
          
        
        
          Apply line overrides
        `;
      document.body.appendChild(modal);
      modal.querySelector('[data-close-defaults]')?.addEventListener('click', () => modal.remove());
      modal.querySelector('[data-apply-defaults]')?.addEventListener('click', () => {
        const overrides = ensureOverrides(config);
        if (!overrides.processData) overrides.processData = {};
        modal.querySelectorAll('[data-default-edit-row][data-default-edit-field]').forEach((input) => {
          const ri = Number(input.getAttribute('data-default-edit-row') || -1);
          const field = input.getAttribute('data-default-edit-field') || '';
          const row = branchRows[ri];
          const value = _toText(input.value).trim();
          if (!row?.lineKey || !field || !value) return;
          if (field === 'wallThickness' || field === 'corrosion') {
            if (!overrides[field]) overrides[field] = {};
            overrides[field][row.lineKey] = value;
          } else {
            if (!overrides.processData[row.lineKey]) overrides.processData[row.lineKey] = {};
            overrides.processData[row.lineKey][field] = value;
          }
        });
        onSaveConfig(config);
        modal.remove();
        refreshPreview();
      });
    });
  }
"""
if "const defaultFields = ['p1', 't1', 't2', 't3', 'density', 'wallThickness', 'corrosion'];" not in preview:
    preview = preview.replace("  host.innerHTML = table.renderHTML();\n  table.bind(host);", "  host.innerHTML = table.renderHTML();\n" + review_block + "  table.bind(host);", 1)

write(preview_path, preview)

# 6) EditablePreviewTable: mark default values
table_path = "viewer/tabs/model-converters/shared/EditablePreviewTable.js"
table = read(table_path)
old_editable_plain = """    const editablePlain = (type, value, key, source = '') => `
      ${this._escape(value || '—')}${source === 'override' ? ' ✓ override' : ''}`;
"""
new_editable_plain = """    const editablePlain = (type, value, key, source = '') => {
      const isDefault = source === 'default' || source === 'config-default' || source === 'default-zero';
      const cls = `mc-preview-editable-val${isDefault ? ' mc-preview-default-val' : ''}`;
      const style = isDefault ? ' style="color:#7f1d1d;font-weight:600;font-style:italic;" title="Config default value"' : '';
      const badge = source === 'override' ? ' ✓ override' : (isDefault ? ' default' : '');
      return `${this._escape(value || '—')}${badge}`;
    };
"""
if old_editable_plain in table:
    table = table.replace(old_editable_plain, new_editable_plain, 1)
write(table_path, table)

# 7) BrowserConverterExecutor replacement
executor_path = "viewer/converters/BrowserConverterExecutor.js"
executor_code = r"""/**
 * BrowserConverterExecutor.js
 *
 * Browser-side adapter around the converter worker contract used by
 * model-converters. It accepts File/Blob input and returns normalized output.
 */

import {
  buildConverterWorkerRequest,
  validateConverterWorkerResponse,
} from './worker-contract.js';

function toText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function inferMime(fileName) {
  const name = toText(fileName).toLowerCase();
  if (name.endsWith('.json')) return 'application/json;charset=utf-8';
  if (name.endsWith('.xml')) return 'application/xml;charset=utf-8';
  if (name.endsWith('.pcf')) return 'text/plain;charset=utf-8';
  return 'text/plain;charset=utf-8';
}

function firstTextOutput(outputs) {
  const list = Array.isArray(outputs) ? outputs : [];
  return list.find((entry) => entry && typeof entry.text === 'string') || null;
}

function sanitizeCloneable(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'function') return undefined;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeCloneable).filter((value) => value !== undefined);
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const cleaned = sanitizeCloneable(value);
    if (cleaned !== undefined) clean[key] = cleaned;
  }
  return clean;
}

function buildWorkerErrorMessage(event, fallback = 'Converter worker crashed.') {
  return [
    toText(event?.message || fallback),
    event?.filename ? `file=${event.filename}` : '',
    event?.lineno ? `line=${event.lineno}` : '',
    event?.colno ? `col=${event.colno}` : '',
    event?.error?.name ? `name=${event.error.name}` : '',
    event?.error?.message ? `error=${event.error.message}` : '',
    event?.error?.stack ? `stack=${event.error.stack}` : '',
  ].filter(Boolean).join(' | ');
}

export function createBrowserConverterExecutor() {
  const worker = new Worker(new URL('./py-worker.js?v=20260609-worker-diagnostics-1', import.meta.url), {
    type: 'module',
  });

  const pending = new Map();
  let nextJobId = 1;
  let disposed = false;

  function rejectAll(error) {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  }

  function normalizeSuccessfulPayload(payload) {
    const outputs = Array.isArray(payload.outputs) ? payload.outputs : [];
    const primaryOutput = firstTextOutput(outputs);
    return {
      ok: true,
      outputs,
      logs: payload.logs || {},
      outputText: primaryOutput ? String(primaryOutput.text) : '',
      outputName: primaryOutput ? String(primaryOutput.name || '') : '',
      outputMime: primaryOutput ? String(primaryOutput.mime || inferMime(primaryOutput.name || 'output.txt')) : 'text/plain;charset=utf-8',
    };
  }

  function onMessage(event) {
    const payload = event.data || {};
    const request = pending.get(payload.jobId);
    if (!request) return;

    pending.delete(payload.jobId);
    const validation = validateConverterWorkerResponse(payload);
    if (!validation.ok) {
      request.reject(new Error(validation.error));
      return;
    }

    if (!payload.ok) {
      const errorMessage = toText(payload.error || 'Converter worker failed.');
      const logs = payload.logs || {};
      const tail = [
        ...(Array.isArray(logs.stderr) ? logs.stderr.slice(-8) : []),
        ...(Array.isArray(logs.stdout) ? logs.stdout.slice(-5) : []),
      ].map(toText).filter(Boolean).join(' | ');
      request.reject(new Error(tail ? `${errorMessage} | ${tail}` : errorMessage));
      return;
    }

    request.resolve(normalizeSuccessfulPayload(payload));
  }

  function onError(event) {
    rejectAll(new Error(buildWorkerErrorMessage(event)));
  }

  function onMessageError(event) {
    rejectAll(new Error(buildWorkerErrorMessage(event, 'Converter worker message serialization failed.')));
  }

  worker.addEventListener('message', onMessage);
  worker.addEventListener('error', onError);
  worker.addEventListener('messageerror', onMessageError);

  async function execute(request) {
    if (disposed) throw new Error('Converter executor has been disposed.');

    const converterId = toText(request?.converterId || '').trim();
    if (!converterId) throw new Error('converterId is required for browser converter execution.');

    const sourceFile = request?.sourceFile || request?.sourceBlob || null;
    const sourceArrayBuffer = request?.sourceArrayBuffer instanceof ArrayBuffer
      ? request.sourceArrayBuffer
      : sourceFile && typeof sourceFile.arrayBuffer === 'function'
        ? await sourceFile.arrayBuffer()
        : null;

    if (!(sourceArrayBuffer instanceof ArrayBuffer)) {
      throw new Error(`Primary source bytes are required for converter ${converterId}.`);
    }

    const sourceName = toText(
      request?.fileName ||
      sourceFile?.name ||
      request?.sourceName ||
      'input.dat'
    ).trim() || 'input.dat';

    const inputFiles = Array.isArray(request?.inputFiles) && request.inputFiles.length
      ? request.inputFiles
      : [{ role: 'primary', name: sourceName, bytes: sourceArrayBuffer }];

    const transfer = [];
    for (const fileSpec of inputFiles) if (fileSpec?.bytes instanceof ArrayBuffer) transfer.push(fileSpec.bytes);

    const jobId = nextJobId;
    nextJobId += 1;

    return new Promise((resolve, reject) => {
      pending.set(jobId, { resolve, reject });
      try {
        worker.postMessage(
          buildConverterWorkerRequest(jobId, converterId, inputFiles, sanitizeCloneable(request?.options || {})),
          transfer
        );
      } catch (error) {
        pending.delete(jobId);
        reject(new Error(`Failed to post converter job to worker: ${toText(error?.message || error)}`));
      }
    });
  }

  function dispose() {
    disposed = true;
    worker.removeEventListener('message', onMessage);
    worker.removeEventListener('error', onError);
    worker.removeEventListener('messageerror', onMessageError);
    worker.terminate();
    pending.clear();
  }

  return { execute, dispose };
}
"""
write(executor_path, executor_code)

# 8) py-worker robust failure handling
worker_path = "viewer/converters/py-worker.js"
worker = read(worker_path)
worker = worker.replace("let _pyodidePromise = null;\nlet _scriptsLoaded = false;", "let _pyodidePromise = null;\nlet _scriptsLoaded = false;\nlet _activeJobId = null;", 1)
if "function _errorToString(error)" not in worker:
    worker = worker.replace(
        "function _toString(value) {\n  if (value === undefined || value === null) return '';\n  return String(value);\n}\n",
        """function _toString(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function _errorToString(error) {
  return [
    _toString(error?.name),
    _toString(error?.message || error),
    _toString(error?.stack),
  ].filter(Boolean).join(' | ');
}

function _postFailure(jobId, message, logs = null) {
  try {
    self.postMessage(buildConverterWorkerResponse(
      jobId,
      false,
      null,
      logs,
      _toString(message || 'Converter worker failed.')
    ));
  } catch {}
}
""",
        1,
    )
worker = worker.replace(
    "const response = await fetch(url, { cache: 'no-store' });\n    if (!response.ok) throw new Error(`Failed to load converter script ${fileName}: HTTP ${response.status}`);\n    const text = _patchConverterScriptText(fileName, await response.text());\n    pyodide.FS.writeFile(`/scripts/${fileName}`, text, { encoding: 'utf8' });",
    "const response = await fetch(url, { cache: 'no-store' });\n    if (!response.ok) throw new Error(`Failed to load converter script ${fileName}: HTTP ${response.status} ${response.statusText || ''}`);\n    const rawText = await response.text();\n    const text = _patchConverterScriptText(fileName, rawText);\n    if (!text.trim()) throw new Error(`Converter script ${fileName} loaded as empty text.`);\n    pyodide.FS.writeFile(`/scripts/${fileName}`, text, { encoding: 'utf8' });",
    1,
)
worker = replace_regex_once(
    worker,
    r"self\.addEventListener\('message', async \(event\) => \{\n[\s\S]*?\n\}\);\s*$",
    """self.addEventListener('message', async (event) => {
  const message = event.data || {};
  if (message.type !== 'run') return;

  const jobId = message.jobId;
  _activeJobId = jobId;

  const validation = validateConverterWorkerRequest(message);
  if (!validation.ok) {
    _postFailure(jobId, validation.error);
    _activeJobId = null;
    return;
  }

  try {
    const result = await _runJob(message);
    self.postMessage(buildConverterWorkerResponse(jobId, true, result.output, result.logs, null));
  } catch (error) {
    _postFailure(jobId, _errorToString(error));
  } finally {
    _activeJobId = null;
  }
});

self.addEventListener('error', (event) => {
  const message = [
    event?.message || 'Unhandled worker error.',
    event?.filename ? `file=${event.filename}` : '',
    event?.lineno ? `line=${event.lineno}` : '',
    event?.colno ? `col=${event.colno}` : '',
    event?.error ? _errorToString(event.error) : '',
  ].filter(Boolean).join(' | ');

  if (_activeJobId !== null && _activeJobId !== undefined) _postFailure(_activeJobId, message);
});

self.addEventListener('unhandledrejection', (event) => {
  const message = `Unhandled worker promise rejection: ${_errorToString(event?.reason)}`;
  if (_activeJobId !== null && _activeJobId !== undefined) _postFailure(_activeJobId, message);
});
""",
    "worker message handler",
)
write(worker_path, worker)

print("Applied XML->CII defaults, wall thickness, Weight Match, and worker diagnostics patch.")
print("Now run:")
print("  node -e \"import('./viewer/tabs/model-converters/legacy-adapter.js')\"")
print("  node -e \"import('./viewer/tabs/model-converters/converters/xmltocii2019_helper/preview-renderer.js')\"")
print("  node -e \"import('./viewer/converters/BrowserConverterExecutor.js')\"")
print("  git diff --stat && git diff")
