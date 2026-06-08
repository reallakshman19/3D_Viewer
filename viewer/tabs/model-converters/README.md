# Model Converters Tab

This module provides a unified architecture for file format converters, breaking down the large monolithic `model-converters-tab.js` into smaller, independent modules.

## Architecture

*   **`index.js` & `ModelConvertersTab.js`**: The main entry points and UI shell.
*   **`converter-registry.js`**: Registers all available converters.
*   **`converters/`**: Each converter has its own directory here containing its definition, workflow, configuration, and necessary sub-modules.
*   **`core/`**: Shared core logic, utilities, types, and event bus.
*   **`shared/`**: Shared UI components like input panels, option panels, and common utilities used by multiple converters.

## Converter Registry

`viewer/tabs/model-converters/converter-registry.js` holds the `CONVERTERS` array. The UI automatically populates the converter dropdown based on this array.

## How to add a new converter

1.  Create a new folder in `viewer/tabs/model-converters/converters/` (e.g., `my-new-converter`).
2.  Create an `index.js` in that folder exporting the converter definition.
    ```javascript
    export const myNewConverter = {
      id: 'my_new_converter',
      label: 'My New Converter',
      group: 'General', // Or whatever group
      inputs: [
        { role: 'primary', label: 'Input File', accept: '.txt', required: true }
      ],
      options: [],
      workflow: null, // Or your workflow spec
      validate: (context) => { ... },
      run: async (context) => { ... }
    };
    ```
3.  Add the new converter to the `CONVERTERS` array in `converter-registry.js`.

## How to reuse XML→CII workflow

The XML→CII workflow is designed to be independent of the Model Converters tab. You can import its components (like the `regex-line-key`, `linelist-mapping`, `preview-model`, etc.) directly into other parts of the application or into dedicated test harnesses.

## Testing

Use the provided scripts to run the tests:

```bash
node scripts/test-model-converters-imports.mjs
node scripts/test-xml-cii-regex-line-key.mjs
node scripts/test-xml-cii-element-length.mjs
node scripts/test-xml-cii-linelist-mapping.mjs
node scripts/test-xml-cii-preview-model.mjs
```
