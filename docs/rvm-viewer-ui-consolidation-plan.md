# RVM Viewer UI consolidation plan

Date: 2026-06-26
Scope: PR 2 shell/slot ownership groundwork.

## Boundary

This plan belongs to Track 1: RVM Viewer UI/runtime consolidation. It does not modify XML->CII conversion logic, InputXML->StagedJSON rich propagation, or the RVM Viewer API authority track.

The implementation in this PR is intentionally small. It creates a shell owner and stable slots so later feature bridges can move from scattered top-level sections into registered UI regions without adding another bridge-only layer.

## Current problem

The 3D RVM Viewer UI has accumulated independently inserted controls and panels:

- toolbar groups owned by several bridges,
- source-preview controls,
- node marker controls,
- support overlay controls,
- Auto Bend diagnostics,
- browser/native diagnostics,
- selection details,
- export and validation blocks.

The immediate More Tools fix now has a single overflow owner. The next structural need is a shell owner that defines where UI content belongs.

## PR 2 implementation

Added `viewer/tabs/RvmViewerUiShell.js`.

The shell owns these stable slots:

| Slot | Purpose |
|---|---|
| `hierarchy` | Existing hierarchy tree / zones / future search results. |
| `selection` | Existing selection/properties inspector. |
| `source-tools` | Source-preview workflow controls. |
| `node-markers` | Node Marker controls/details. |
| `supports` | Support overlay controls/details. |
| `diagnostics` | Browser/native diagnostics and future model health messages. |
| `exports` | Future grouped exports/audit outputs. |

The shell exposes:

```js
installRvmViewerUiShell(root, options)
disposeRvmViewerUiShell(root)
syncRvmViewerUiShell(root, options)
registerRvmToolPanel(root, panel)
setRvmRightPanelTab(root, tabId, reason)
auditRvmViewerUiShell(root)
getRvmViewerUiShellDiagnostics(root)
```

## Runtime behavior

The shell is installed by `viewer3d-rvm-tab-renderer.js`, but it does not assume the RVM tab DOM exists at module-import time. If `[data-rvm-viewer]` is not present yet, it schedules bounded bootstrap attempts and installs once the tab root appears.

The shell preserves existing runtime content:

- `#rvm-tree` remains available and is wrapped into the `hierarchy` slot.
- `#rvm-attributes-panel` remains available and is moved into the `selection` slot.
- `#rvm-browser-parse-diagnostics` remains available and is moved into the `diagnostics` slot.

The shell adds a compact right-panel tab row:

- Selection
- Source Tools
- Node Markers
- Supports
- Diagnostics

This is the first step toward reducing permanent UI clutter while keeping existing IDs and selectors compatible.

## Auditability

The shell stamps:

- `root.dataset.rvmUiShellVersion`
- `root.dataset.rvmUiShellAudit`
- `data-rvm-panel-region`
- `data-rvm-panel-slot`
- `data-rvm-right-panel-tabs`
- `data-rvm-right-panel-tab`

`auditRvmViewerUiShell()` verifies required regions and slot uniqueness for the first controlled shell contract:

- left panel exists,
- right panel exists,
- viewport exists,
- exactly one `hierarchy` slot,
- exactly one `selection` slot,
- exactly one `diagnostics` slot.

`getRvmViewerUiShellDiagnostics()` reports:

- version,
- install/sync counts,
- active right-panel tab,
- registered feature panels,
- pre-sync and post-sync audit evidence,
- bounded trace entries.

## Tests

`viewer/tests/rvm-ui-shell-contract.test.js` verifies the source-level shell contract.

`viewer/tests/rvm-viewer-ui-contract.test.js` imports the shell contract into the existing RVM viewer UI CI path by asserting:

- renderer imports and installs the shell,
- shell exposes stable slots,
- shell exposes registration and audit APIs,
- shell has bootstrap readiness,
- shell preserves existing attributes/diagnostics panels,
- shell does not include XML->CII worker/conversion logic.

## Not included in PR 2

This PR does not yet move source-preview bridges into the shell registration API. That should be a later PR after verifying all active module insertion points.

This PR does not create the central interaction router. That remains a separate phase.

This PR does not change overlay rendering/disposal policy.

This PR does not treat the RVM Viewer API output as an XML->CII authority.

## Next phase

PR 3 should start moving non-primitive Source Tools / Node Marker / Support controls into the `source-tools`, `node-markers`, and `supports` slots using the registration API. Each bridge should register into a slot rather than independently creating permanent top-level UI blocks.
