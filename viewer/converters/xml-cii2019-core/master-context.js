import { parseXmlCiiEnrichmentConfig } from './config.js';
import { buildPipingClassIndex } from './piping-class-resolver.js';
import {
  loadXmlCiiMaterialMap,
  loadXmlCiiMasterRows,
  loadXmlCiiWeightMasterRows,
} from '../../tabs/model-converters/converters/xmltocii2019_helper/enrichment-core.js';

const DEFAULT_PIPING_CLASS_MASTER_URLS = Object.freeze([
  '../docs/Masters/Piping_class_master.json',
  'docs/Masters/Piping_class_master.json',
  '../docs/Masters/SpecwisePipingClass/index.json',
  'docs/Masters/SpecwisePipingClass/index.json',
]);

function _ensureSection(config, key) {
  if (!config[key] || typeof config[key] !== 'object' || Array.isArray(config[key])) {
    config[key] = {};
  }
  return config[key];
}

function _asRows(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Build the shared XML→CII(2019) master context used by both XML→CII and
 * JSON/RVM→PCF row enrichment.
 *
 * This module intentionally reuses the existing XML→CII master loaders instead
 * of duplicating file fetch / parse logic. A later cleanup can move the loader
 * implementations here and re-export them back to the legacy enrichment helper;
 * this first pass provides the stable shared context contract with no behavior
 * fork.
 */
export async function prepareXmlCiiMasterContext({
  rawConfig = {},
  diagnostics = [],
} = {}) {
  const configInput = typeof rawConfig === 'string'
    ? rawConfig
    : JSON.stringify(rawConfig || {});

  const config = parseXmlCiiEnrichmentConfig(configInput);
  const material = _ensureSection(config, 'material');
  const pipingClass = _ensureSection(config, 'pipingClass');
  _ensureSection(config, 'weight');
  _ensureSection(config, 'linelist');

  await loadXmlCiiWeightMasterRows(config, diagnostics);
  const materialMapRows = await loadXmlCiiMaterialMap(config, diagnostics);
  const pipingClassRows = await loadXmlCiiMasterRows(
    pipingClass,
    DEFAULT_PIPING_CLASS_MASTER_URLS,
    'piping-class',
    diagnostics
  );

  material.mapRows = materialMapRows;
  pipingClass.masterRows = pipingClassRows;

  const lineRows = _asRows(config.linelist?.masterRows);
  const weightMasterRows = _asRows(config.weight?.masterRows);
  const pipingClassIndex = buildPipingClassIndex(pipingClassRows);

  return {
    config,
    diagnostics,
    lineRows,
    materialMapRows,
    pipingClassRows,
    pipingClassIndex,
    weightMasterRows,
  };
}

export {
  DEFAULT_PIPING_CLASS_MASTER_URLS,
  loadXmlCiiMaterialMap,
  loadXmlCiiMasterRows,
  loadXmlCiiWeightMasterRows,
};
