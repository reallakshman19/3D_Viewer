# Monolith Extraction Map

This document maps all remaining functions in `ModelConvertersTab.js` to track their risk, reads, writes, DOM dependencies, and target extraction destination.

| Function / Block | Category | Reads | Writes | DOM dependency | Target module | Extraction risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `_clone` | Utilities | Arguments | Return val | None | `core/utils.js` | Low |
| `_sameTextArray` | Utilities | Arguments | Return val | None | `core/utils.js` | Low |
| `_toText` | Utilities | Arguments | Return val | None | `core/utils.js` | Low |
| `_esc` | Utilities | Arguments | Return val | None | `core/dom-utils.js` | Low |
| `_escAttr` | Utilities | Arguments | Return val | None | `core/dom-utils.js` | Low |
| `_xmlCiiNormalizeHeader` | XML→CII line-list mapping | Arguments | Return val | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiWordTokens` | XML→CII line-list mapping | Arguments | Return val | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiHeaderScore` | XML→CII line-list mapping | Arguments | Return val | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiParseDelimitedText` | Utilities / IO | Arguments | Return val | None | `core/file-utils.js` | Low |
| `_xmlCiiParseMaterialMapText` | XML→CII config | Arguments | Return val | None | `xml-to-cii2019/masters.js` | Low |
| `_xmlCiiHeadersFromRows` | XML→CII line-list mapping | Arguments | Return val | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiBuildColumnPreviewMap` | XML→CII line-list mapping | Arguments | Return val | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiLabelRowHint` | XML→CII line-list mapping | Arguments | Return val | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiDataValueScore` | XML→CII line-list mapping | Arguments | Return val | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiOrderedAliasEntries` | XML→CII config | Arguments | Return val | None | `xml-to-cii2019/masters.js` | Low |
| `_xmlCiiAutoMapFields` | XML→CII line-list mapping | Arguments | Return val | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiMapRowsWithFieldMap` | XML→CII line-list mapping | Arguments | Return val | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiConvertLineListBore` | XML→CII line-list mapping | Arguments | Return val | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiRowsToTableHtml` | Utilities / UI | Arguments | HTML String | None | `core/table-utils.js` | Low |
| `_xmlCiiParseJsonRows` | Utilities / IO | Arguments | Return val | None | `core/file-utils.js` | Low |
| `_xmlCiiMasterRowsFromConfig` | XML→CII config | Config | Array | None | `xml-to-cii2019/masters.js` | Low |
| `_xmlCiiMasterFieldMapFromConfig`| XML→CII config | Config | Object | None | `xml-to-cii2019/masters.js` | Low |
| `_xmlCiiSaveMasterToConfig` | XML→CII config | Arguments | Config mutation | None | `xml-to-cii2019/masters.js` | Low |
| `_createWorkerRuntime` | Worker/run orchestration | None | Worker ref | None | `core/converter-runner.js` | Medium |
| `_loadStoredState` | Generic shell | LocalStorage | State object | None | `core/config-store.js` | Low |
| `_storageSafeDefaults` | Generic shell | Arguments | JSON Object | None | `core/config-store.js` | Low |
| `_saveStoredState` | Generic shell | Arguments | LocalStorage | None | `core/config-store.js` | Low |
| `_xmlCiiCompactConfigForEditor` | XML→CII config | Arguments | String | None | `xml-to-cii2019/config.js` | Low |
| `_xmlCiiMergeEditedConfig` | XML→CII config | Arguments | String | None | `xml-to-cii2019/config.js` | Low |
| `_readOptionValue` | Generic shell | DOM Input | Typed Value | DOM Input node | `shared/OptionPanel.js` | Medium |
| `_deriveLineKeyFromBranchName` | XML→CII regex/line-key | String, Config | String | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_deriveBranchLineKey` | XML→CII regex/line-key | String, Config | String | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_xmlCiiLineKeyRegexValue` | XML→CII regex/line-key | String, Regex | String | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_xmlCiiNormalizeLineKey` | XML→CII regex/line-key | String | String | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_xmlCiiFindLineListRow` | XML→CII line-list mapping| Key, Config | Row object | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiProcessValue` | XML→CII line-list mapping| Overrides, Row | Value | None | `xml-to-cii2019/linelist-mapping.js` | Low |
| `_xmlCiiApplyLineListProcessData`| XML→CII line-list mapping| DOM Node | Mutates DOM Node| XML DOM | `xml-to-cii2019/linelist-mapping.js` | Medium |
| `_regexGroup` | Utilities | String, Regex | String | None | `core/utils.js` | Low |
| `_branchTokens` | XML→CII regex/line-key | String | Array | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_tokenAtPosition` | XML→CII regex/line-key | String | String | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_xmlCiiTokenPositionList` | XML→CII regex/line-key | String | Array | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_xmlCiiLineKeyFromBranchTokens`| XML→CII regex/line-key | String | String | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_xmlCiiCleanSizeToken` | XML→CII regex/line-key | String | String | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_deriveXmlCiiSizeTokenFromBranchName`| XML→CII regex/line-key| String | String | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_derivePipingClassFromBranchName`| XML→CII regex/line-key| String | String | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_deriveRatingFromPipingClass` | XML→CII regex/line-key| String | String | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_nominalDnFromNps` | XML→CII masters | Value | Value | None | `xml-to-cii2019/masters.js` | Low |
| `_deriveBoreFromBranchName` | XML→CII regex/line-key| String | Number | None | `xml-to-cii2019/regex-line-key.js` | Low |
| `_pointDistanceMm` | Utilities | Point, Point | Number | None | `core/utils.js` | Low |
