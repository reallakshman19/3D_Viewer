import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function run() {
  const supportBridgeSource = await readFile(new URL('../../../rvm-viewer/RvmSupportIndexAttributeBridge.js', import.meta.url), 'utf8');
  const tabSource = await readFile(new URL('../../../tabs/viewer3d-rvm-tab.js', import.meta.url), 'utf8');

  assert.match(
    supportBridgeSource,
    /export\s+function\s+bridgeRvmIndexAttributesToRenderObjects\(/,
    'Support index bridge must keep attribute enrichment for JSON/UXML/index-backed scenes.'
  );
  assert.match(
    supportBridgeSource,
    /export\s+function\s+installRvmSupportIndexAttributeBridge\(/,
    'Support index bridge must keep the setModel support-attribute merge hook.'
  );
  assert.match(
    supportBridgeSource,
    /skippedProgressiveRvm:\s*true/,
    'Support index bridge must not traverse progressive browser RVM scenes during first mount.'
  );
  assert.match(
    supportBridgeSource,
    /RvmViewer3D\.js\?v=20260620-rvm-direct-tab-1/,
    'Support index bridge cache key must match the direct RVM tab viewer cache key.'
  );

  assert.doesNotMatch(
    supportBridgeSource,
    /FileCtor|proto\.text|patchedRvmFileText|parseRvmArrayBuffer|loadRvmFileInBrowser|isLikelyRvmFileName/,
    'Support index bridge must not patch File.text or parse/load RVM files.'
  );
  assert.doesNotMatch(
    supportBridgeSource,
    /patchRvmTabDom|addEventListener\(['"]change['"]|stopImmediatePropagation|installBrowserRvmTabFileFallback|installBrowserRvmTabDomPatch/,
    'Support index bridge must not install DOM/file-input interception side effects.'
  );

  assert.match(
    tabSource,
    /title="Load RVM \/ REV \/ ATT \/ JSON \/ UXML"/,
    'RVM tab static source must advertise RVM / REV / ATT / JSON / UXML.'
  );
  assert.match(
    tabSource,
    /id="rvm-file-input"[^>]+accept="\.json,\.uxml,\.uxml\.json,\.rvm,\.rev,\.att"[^>]+multiple/,
    'RVM tab static file input must accept .rvm, .rev, and .att sidecars directly in the template.'
  );
  assert.match(
    tabSource,
    /data-rvm-direct-worker-load="true"/,
    'RVM tab input must expose the direct worker load marker.'
  );
  assert.match(
    tabSource,
    /Load RVM \/ REV \/ ATT \/ JSON \/ UXML to view hierarchy\./,
    'RVM hierarchy empty-state text must be correct in static source.'
  );
  assert.match(
    tabSource,
    /Load RVM \/ REV \/ ATT \/ JSON \/ UXML to begin\./,
    'RVM viewport placeholder text must be correct in static source.'
  );
  assert.doesNotMatch(
    tabSource,
    /Load JSON\/UXML to view hierarchy|Load RVM JSON \/ UXML to begin/,
    'RVM tab static source must not regress to old JSON/UXML-only wording.'
  );

  assert.match(
    tabSource,
    /import\s+\{\s*loadRvmFileInBrowser\s*\}\s+from\s+['"]\.\.\/rvm\/BrowserRvmLoadBridge\.js\?v=20260620-rvm-tree-select-nohide-1['"]/,
    'The actual RVM tab must import the current worker-first load bridge directly.'
  );
  assert.match(
    tabSource,
    /RVM_TAB_JS_VERSION\s*=\s*['"]20260620-rvm-tree-select-nohide-1['"]/,
    'The RVM tab diagnostics version must identify the active tree-select/no-hide path.'
  );
  assert.match(
    tabSource,
    /import\s+['"]\.\.\/rvm-viewer\/RvmSupportIndexAttributeBridge\.js\?v=20260620-rvm-direct-tab-1['"]/,
    'The tab must not import a stale cached support bridge URL.'
  );
  assert.match(
    tabSource,
    /const\s+rvmFile\s*=\s*files\.find\(\(file\)\s*=>\s*isLikelyRvmFileName\(file\?\.name\)\)/,
    'The actual tab change handler must branch explicitly for .rvm/.rev files.'
  );
  assert.match(
    tabSource,
    /await\s+loadDirectBrowserRvm\(\{\s*root,\s*viewer,\s*files,\s*rvmFile,\s*stateBag\s*\}\)/,
    'The .rvm/.rev branch must call the direct worker load path.'
  );
  assert.match(
    tabSource,
    /allowMainThreadParserFallback:\s*false[\s\S]*buildHierarchyFallback:\s*false/,
    'The direct RVM path must forbid large main-thread fallback and old hierarchy fallback.'
  );
  assert.doesNotMatch(
    tabSource,
    /const\s+bounds\s*=\s*payload\.browserRvmRender\?\.bounds/,
    'The tab must not perform a duplicate post-load raw-bounds fit.'
  );

  const rvmBranchStart = tabSource.indexOf('if (rvmFile)');
  const jsonBranchStart = tabSource.indexOf('const jsonFile', rvmBranchStart);
  assert.ok(rvmBranchStart > 0 && jsonBranchStart > rvmBranchStart, 'The direct RVM branch must be before JSON/UXML handling.');
  const rvmBranch = tabSource.slice(rvmBranchStart, jsonBranchStart);
  assert.doesNotMatch(
    rvmBranch,
    /loadJsonOrUxmlFile|JSON\.parse|\.text\(\)/,
    'The .rvm/.rev path must never call the JSON/UXML text loader.'
  );

  console.log('Browser RVM direct tab contract test passed');
}

run();
