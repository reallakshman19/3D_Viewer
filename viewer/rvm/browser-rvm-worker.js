import { parseRvmArrayBuffer } from './BrowserRvmHierarchyParser.js';

self.onmessage = async (event) => {
  const { id, arrayBuffer, options = {} } = event.data || {};
  try {
    const result = await parseRvmArrayBuffer(arrayBuffer, options);
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: {
        message: error?.message || String(error),
        stack: error?.stack || ''
      }
    });
  }
};
