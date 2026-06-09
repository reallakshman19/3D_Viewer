// XML->CII compact Config editor compatibility.
//
// legacy-adapter.js references STORAGE_MASTER_ARRAY_PATHS while compacting the
// large supportConfigJson before it is shown in tab 7 Config. Keep this value
// available as a global before legacy-adapter.js is evaluated, so the Config tab
// cannot fail with ReferenceError if storage internals are reorganized.

const XML_CII_STORAGE_MASTER_ARRAY_PATHS = Object.freeze([
  Object.freeze(['linelist', 'masterRows']),
  Object.freeze(['pipingClass', 'masterRows']),
  Object.freeze(['material', 'mapRows']),
  Object.freeze(['weight', 'masterRows']),
]);

if (!globalThis.XML_CII_STORAGE_MASTER_ARRAY_PATHS) {
  Object.defineProperty(globalThis, 'XML_CII_STORAGE_MASTER_ARRAY_PATHS', {
    value: XML_CII_STORAGE_MASTER_ARRAY_PATHS,
    configurable: true,
  });
}

if (!globalThis.STORAGE_MASTER_ARRAY_PATHS) {
  Object.defineProperty(globalThis, 'STORAGE_MASTER_ARRAY_PATHS', {
    value: globalThis.XML_CII_STORAGE_MASTER_ARRAY_PATHS,
    configurable: true,
  });
}
