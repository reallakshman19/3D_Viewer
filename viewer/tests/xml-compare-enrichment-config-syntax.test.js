import assert from 'node:assert/strict';

import {
  DEFAULT_ENRICHMENT_CONFIG,
  XML_COMPARE_ENRICHMENT_CONFIG_SCHEMA,
  createEnrichmentConfig,
  renderXmlCompareEnrichmentConfigPopupHtml,
} from '../xml-compare/XmlCompareEnrichmentConfig.js';

assert.equal(XML_COMPARE_ENRICHMENT_CONFIG_SCHEMA, 'xml-compare-enrichment-config/v2-syntax-fix');
assert.ok(DEFAULT_ENRICHMENT_CONFIG.dtxr.typeMapText.includes('TYPE\tKIND\tDTXR_POS'), 'default DTXR map must include header');
assert.ok(DEFAULT_ENRICHMENT_CONFIG.dtxr.typeMapText.includes('\n17\tREST\tPIPE SUPPORT'), 'default DTXR map must preserve multiline rows through escaped newlines');

const cfg = createEnrichmentConfig({ open: true, activeEnrTab: 'component' });
const html = renderXmlCompareEnrichmentConfigPopupHtml(cfg);
assert.match(html, /Enrichment Config/);
assert.match(html, /TYPE map/);
assert.match(html, /TYPE\tKIND\tDTXR_POS/);

console.log('xml-compare-enrichment-config-syntax: all assertions passed');
