# Module Usage Report

This document traces the active imports and executions of the newly extracted core modules within the XML→CII Workflow, proving that the refactoring has successfully bridged the gap from placeholder files to actively running logic.

## 1. \`xml-to-cii2019/regex-line-key.js\`
* **Exports:** \`_deriveBranchLineKey\`, \`_xmlCiiLineKeyRegexValue\`, \`_xmlCiiNormalizeLineKey\`, \`_regexGroup\`, \`_branchTokens\`, \`_tokenAtPosition\`, \`_xmlCiiTokenPositionList\`, \`_xmlCiiLineKeyFromBranchTokens\`, \`_xmlCiiCleanSizeToken\`, \`_deriveXmlCiiSizeTokenFromBranchName\`, \`_derivePipingClassFromBranchName\`, \`_deriveRatingFromPipingClass\`, \`_deriveBoreFromBranchName\`.
* **Imported by:** \`viewer/tabs/model-converters/ModelConvertersTab.js\`
* **Runtime call site:** Used inside XML→CII Regex Preview phase when users input mock branch names to test their Regex captures.
* **Old function removed:** Monolith inline functions stripped via regex match rewiring.
* **Test covering it:** \`scripts/test-xml-cii-regex-line-key.mjs\` and runtime verification.

## 2. \`xml-to-cii2019/linelist-mapping.js\`
* **Exports:** \`_xmlCiiNormalizeHeader\`, \`_xmlCiiWordTokens\`, \`_xmlCiiHeaderScore\`, \`_xmlCiiHeadersFromRows\`, \`_xmlCiiBuildColumnPreviewMap\`, \`_xmlCiiLabelRowHint\`, \`_xmlCiiDataValueScore\`, \`_xmlCiiAutoMapFields\`, \`_xmlCiiMapRowsWithFieldMap\`, \`_xmlCiiConvertLineListBore\`, \`_xmlCiiFindLineListRow\`, \`_xmlCiiProcessValue\`.
* **Imported by:** \`viewer/tabs/model-converters/ModelConvertersTab.js\`
* **Runtime call site:** Triggered natively during Phase 2 (Import Masters) when the user uploads a CSV and the system auto-detects `lineKey`, `t1`, `p1`, `hydroPressure`, etc., via the heuristic maps.
* **Old function removed:** Monolith inline functions stripped via regex match rewiring.
* **Test covering it:** \`scripts/test-xml-cii-linelist-mapping.mjs\`

## 3. \`xml-to-cii2019/dtxr-resolver.js\`
* **Exports:** \`_buildStagedSupportIndex\`, \`_buildStagedComponentIndex\`, \`_stagedComponentForXmlNode\`, \`_stagedComponentDtxr\`, \`_xmlCiiDtxrPsForNode\`, \`_xmlCiiDtxrPositionOffset\`, \`_xmlCiiApplyDtxrPositionOffset\`, \`_xmlCiiPositionsMatch\`, \`_buildStagedDtxrPositionIndex\`, \`_xmlCiiDtxrPosForNode\`, \`_supportTagsFromText\`, \`_supportTagsFromAttrs\`, \`_normalizeSupportTag\`.
* **Imported by:** \`viewer/tabs/model-converters/ModelConvertersTab.js\`
* **Runtime call site:** Staged JSON DTXR alignment runs cleanly through the exported resolver algorithms when Staged JSON inputs are uploaded in conjunction with XML.

## 4. \`xml-to-cii2019/weight-match-model.js\`
* **Exports:** \`_findWeightMasterMatch\`, \`_findAllWeightCandidates\`, \`_xmlCiiWeightCandidateFromRow\`, \`_scoreXmlCiiWeightCandidates\`, \`_normalizedXmlCiiRating\`.
* **Imported by:** \`viewer/tabs/model-converters/ModelConvertersTab.js\`
* **Runtime call site:** Executes natively in Phase 4A (Weight Match).

## 5. \`xml-to-cii2019/element-length.js\`
* **Exports:** \`_xmlCiiForwardElementLengths\`.
* **Imported by:** \`viewer/tabs/model-converters/ModelConvertersTab.js\`
* **Runtime call site:** Pre-run and payload formulation phases defer to this helper for base vector setups before sending out to the Python backend (which possesses final authority).

## 6. \`xml-to-cii2019/preview-model.js\` & \`preview-renderer.js\`
* **Exports:** \`_xmlCiiKnownClasses\`, \`_xmlCiiApproximateClass\`, \`_findPipingClassMaster\`, \`_xmlCiiResolveMaterialCode\`, \`_deriveRatingText\`, \`_deriveWeightText\`, \`_xmlCiiRowsToTableHtml\`.
* **Imported by:** \`viewer/tabs/model-converters/ModelConvertersTab.js\`
* **Runtime call site:** Executes purely in Phase 3 Preview generating standard HTML layout constructs stripped of direct mutation observers.
