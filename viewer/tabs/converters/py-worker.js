// Compatibility shim for legacy-adapter.js.
// legacy-adapter.js resolves ../converters/py-worker.js from viewer/tabs/model-converters/,
// which points here. Keep the real worker implementation in viewer/converters/.
import '../../converters/py-worker.js';
