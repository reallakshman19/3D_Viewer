/**
 * BrowserConverterExecutor.js
 *
 * Browser-side adapter around the converter worker contract used by
 * model-converters. It accepts File/Blob input and returns normalized output.
 */

import {
  buildConverterWorkerRequest,
  validateConverterWorkerResponse,
} from './worker-contract.js';

const XML_TRAILING_MINUS_CONVERTERS = new Set(['xml_to_cii', 'inputxml_to_cii2019']);
const XML_TEXT_ENCODER = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const XML_TEXT_DECODER = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

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

export function normalizeTrailingMinusNumericXmlText(xmlText) {
  return toText(xmlText).replace(
    />(\s*)(\d+(?:\.\d*)?|\.\d+)([eE][+-]?\d+)?-(\s*)</g,
    (_match, lead, number, exponent = '', tail) => `>${lead}-${number}${exponent}${tail}<`,
  );
}

function looksLikeXmlFile(fileSpec) {
  const name = toText(fileSpec?.name).toLowerCase();
  return name.endsWith('.xml') || name.endsWith('.input') || name.endsWith('.txt');
}

function normalizeXmlInputFileSpec(converterId, fileSpec) {
  if (!XML_TRAILING_MINUS_CONVERTERS.has(converterId)) return fileSpec;
  if (!fileSpec?.bytes || !looksLikeXmlFile(fileSpec) || !XML_TEXT_DECODER || !XML_TEXT_ENCODER) return fileSpec;
  const original = XML_TEXT_DECODER.decode(fileSpec.bytes);
  if (!/^\s*</.test(original)) return fileSpec;
  const normalized = normalizeTrailingMinusNumericXmlText(original);
  if (normalized === original) return fileSpec;
  return { ...fileSpec, bytes: XML_TEXT_ENCODER.encode(normalized).buffer };
}

export function normalizeConverterInputFiles(converterId, inputFiles) {
  return (Array.isArray(inputFiles) ? inputFiles : []).map((fileSpec) => normalizeXmlInputFileSpec(converterId, fileSpec));
}

export function createBrowserConverterExecutor() {
  const worker = new Worker(new URL('./py-worker.js?v=20260629-trailing-minus-xml-1', import.meta.url), {
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

    const inputFiles = normalizeConverterInputFiles(
      converterId,
      Array.isArray(request?.inputFiles) && request.inputFiles.length
        ? request.inputFiles
        : [{ role: 'primary', name: sourceName, bytes: sourceArrayBuffer }]
    );

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
