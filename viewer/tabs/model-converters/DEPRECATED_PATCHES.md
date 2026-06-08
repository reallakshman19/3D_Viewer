# Deprecated Patches

The following hotfix-style patch files were identified as violating the required component boundaries. They have been removed from the core import paths, and their logical rules have been placed into the dedicated modular converters inside \`viewer/tabs/model-converters/converters/\`.

## Temporarily Retained (Awaiting Full File Deletion)
These files are kept in the repository purely as reference during the migration window but should not be imported by any active application modules.

* \`xml-cii-preview-stable-patch.js\`
* \`xml-cii-hydro-ui-patch.js\`
* \`xml-cii-regex-preview-fix.js\`
* \`xml-cii-workflow-order-fix.js\`
* \`xml-cii-element-length-run-patch.js\`
* \`xml-cii-support-direction-table.js\`

## Source Modules Replacing the Patches
* **Preview Stable Patch** -> Logic has moved to \`xml-to-cii2019/preview-model.js\` and \`preview-renderer.js\`. Previews now render from a fixed column model without DOM mutation post-render.
* **Hydro UI Patch** -> Logic mapped cleanly inside \`xml-to-cii2019/linelist-mapping.js\`. No random dropdown injections occur.
* **Regex Preview Fix** -> \`xml-to-cii2019/regex-line-key.js\` validates preview samples.
* **Workflow Order Fix** -> Workflow array order specifies 4A before 5 natively in the module config.
* **Element Length Run Patch** -> Length calculated as SRSS in \`xml-to-cii2019/element-length.js\`. Final authority rests in the Python patch.
* **Support Direction Table** -> Logic consolidated into the \`Support Types\` workflow phase; duplicate "9 CII Support Mapping" removed entirely.
