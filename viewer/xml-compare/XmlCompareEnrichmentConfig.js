export const ENRICHMENT_CONFIG_SCHEMA = 'xml-compare-enrichment-config/v1';

const COMP_TYPES = ['ATTA', 'ELBO', 'BRAN', 'OLET', 'RIGID', 'TEE', 'PIPE'];

const DEFAULT_RESTRAINT_TYPE_CONVERT_ROWS = Object.freeze([
  Object.freeze({ label: '+Y',  from: '17', to: '14' }),
  Object.freeze({ label: 'LIM', from: '7',  to: '8'  }),
  Object.freeze({ label: 'GUI', from: '10', to: '9'  }),
  Object.freeze({ label: 'X',   from: '1',  to: '2'  }),
  Object.freeze({ label: 'Y',   from: '2',  to: '3'  }),
  Object.freeze({ label: 'Z',   from: '3',  to: '5'  }),
  Object.freeze({ label: '',    from: '18', to: '15' }),
]);

export const DEFAULT_ENRICHMENT_CONFIG = Object.freeze({
  pipingClass: Object.freeze({ enabled: true, regex: '([0-9]{5})', group: '1', tokenPosition: '4', tokenDelimiter: '-' }),
  rating:       Object.freeze({ enabled: true, method: 'table', tableText: '', fixedValue: '' }),
  componentType: Object.freeze({ enabled: true, bendType: 'ELBO', sifType: 'BRAN', rigidType: 'ATTA', defaultType: 'ATTA' }),
  position:     Object.freeze({ enabled: false, startX: '', startY: '', startZ: '' }),
  dtxr:         Object.freeze({ enabled: true, typeMapText: 'TYPE\tKIND\tDTXR_POS\n0\tANCHOR\tANCHOR\n3\tREST\tPIPE SUPPORT\n5\tREST\tPIPE SUPPORT\n7\tGUIDE\tGUIDE\n10\tGUIDE\tGUIDE\n17\tREST\tPIPE SUPPORT' }),
  pointPropertiesBasis: Object.freeze({ enabled: true, value: 'TO' }),
  restraintTypeConvert: Object.freeze({ enabled: false, rows: DEFAULT_RESTRAINT_TYPE_CONVERT_ROWS }),
});

const ENR_TABS = Object.freeze([
  { key: 'restraint',   label: 'Restraint Types', icon: '⇄', sectionKeys: ['restraintTypeConvert'] },
  { key: 'class',       label: 'Classification',  icon: '⊞', sectionKeys: ['pipingClass', 'rating'] },
  { key: 'component',   label: 'Component',       icon: '⬡', sectionKeys: ['componentType', 'dtxr'] },
  { key: 'geometry',    label: 'Geometry',        icon: '⊕', sectionKeys: ['position', 'pointPropertiesBasis'] },
]);

export function createEnrichmentConfig(overrides = {}) {
  return {
    open: false,
    activeEnrTab: overrides.activeEnrTab || 'restraint',
    pipingClass:          { ...DEFAULT_ENRICHMENT_CONFIG.pipingClass,          ...(overrides.pipingClass          || {}) },
    rating:               { ...DEFAULT_ENRICHMENT_CONFIG.rating,               ...(overrides.rating               || {}) },
    componentType:        { ...DEFAULT_ENRICHMENT_CONFIG.componentType,        ...(overrides.componentType        || {}) },
    position:             { ...DEFAULT_ENRICHMENT_CONFIG.position,             ...(overrides.position             || {}) },
    dtxr:                 { ...DEFAULT_ENRICHMENT_CONFIG.dtxr,                 ...(overrides.dtxr                 || {}) },
    pointPropertiesBasis: { ...DEFAULT_ENRICHMENT_CONFIG.pointPropertiesBasis, ...(overrides.pointPropertiesBasis || {}) },
    restraintTypeConvert: {
      ...DEFAULT_ENRICHMENT_CONFIG.restraintTypeConvert,
      ...(overrides.restraintTypeConvert || {}),
      rows: Array.isArray(overrides.restraintTypeConvert?.rows)
        ? overrides.restraintTypeConvert.rows.map(r => ({ ...r }))
        : DEFAULT_RESTRAINT_TYPE_CONVERT_ROWS.map(r => ({ ...r })),
    },
  };
}

const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function enrField(id, label, value, type = 'text', placeholder = '', extra = '') {
  return `<label class="enr-field"><span>${esc(label)}</span><input type="${type}" data-enr-field="${esc(id)}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${extra}></label>`;
}

function enrSelect(id, label, value, options) {
  const opts = options.map(o => `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('');
  const lbl = label ? `<span>${esc(label)}</span>` : '';
  return `<label class="enr-field">${lbl}<select data-enr-field="${esc(id)}">${opts}</select></label>`;
}

function enrTextarea(id, label, value, placeholder) {
  return `<label class="enr-textarea-label"><span>${esc(label)}</span><textarea data-enr-field="${esc(id)}" spellcheck="false" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
}

function enrSection(toggleKey, title, enabled, body) {
  return `<section class="enr-section ${enabled ? 'is-enabled' : 'is-disabled'}">
    <label class="enr-section-toggle"><input type="checkbox" data-enr-toggle="${esc(toggleKey)}" ${enabled ? 'checked' : ''}><span>${esc(title)}</span></label>
    <div class="enr-section-content">${body}</div>
  </section>`;
}

function renderRestraintTypeConvertSection(rtc) {
  const rows = Array.isArray(rtc.rows) ? rtc.rows : DEFAULT_RESTRAINT_TYPE_CONVERT_ROWS.map(r => ({ ...r }));
  const tableRows = rows.map((row, i) => `<tr>
      <td><input class="enr-rtc-label" type="text" data-enr-rtc-row="${i}" data-enr-rtc-col="label" value="${esc(row.label || '')}" placeholder="label"></td>
      <td><input class="enr-rtc-num" type="number" data-enr-rtc-row="${i}" data-enr-rtc-col="from" value="${esc(row.from || '')}" placeholder="e.g. 17" min="0" step="1"></td>
      <td class="enr-rtc-arrow">→</td>
      <td><input class="enr-rtc-num" type="number" data-enr-rtc-row="${i}" data-enr-rtc-col="to" value="${esc(row.to || '')}" placeholder="e.g. 14" min="0" step="1"></td>
      <td><button type="button" class="enr-rtc-del" data-xml-compare-action="delete-restraint-type-row" data-row-index="${i}">✕</button></td>
    </tr>`).join('');

  const body = `<table class="enr-rtc-table">
      <thead><tr><th>Label</th><th>Source TYPE</th><th></th><th>Convert to</th><th></th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <button type="button" class="enr-rtc-add" data-xml-compare-action="add-restraint-type-row">+ Add row</button>
    <p class="enr-hint">Rewrites RESTRAINT TYPE numbers in the source XML before other enrichments run. Useful when the model uses non-standard type codes. Applied only when "Apply to loaded XML" is clicked.</p>`;

  return enrSection('restraintTypeConvert', 'Apply Restraint Type corrections to imported XML', rtc.enabled, body);
}

export function renderXmlCompareEnrichmentConfigPopupHtml(config = {}) {
  if (!config.open) return '';

  const activeTab = config.activeEnrTab || 'restraint';

  const pc   = { ...DEFAULT_ENRICHMENT_CONFIG.pipingClass,          ...(config.pipingClass          || {}) };
  const rt   = { ...DEFAULT_ENRICHMENT_CONFIG.rating,               ...(config.rating               || {}) };
  const ct   = { ...DEFAULT_ENRICHMENT_CONFIG.componentType,        ...(config.componentType        || {}) };
  const pos  = { ...DEFAULT_ENRICHMENT_CONFIG.position,             ...(config.position             || {}) };
  const dtxr = { ...DEFAULT_ENRICHMENT_CONFIG.dtxr,                 ...(config.dtxr                 || {}) };
  const ppb  = { ...DEFAULT_ENRICHMENT_CONFIG.pointPropertiesBasis, ...(config.pointPropertiesBasis || {}) };
  const rtc  = {
    ...DEFAULT_ENRICHMENT_CONFIG.restraintTypeConvert,
    ...(config.restraintTypeConvert || {}),
    rows: config.restraintTypeConvert?.rows || DEFAULT_RESTRAINT_TYPE_CONVERT_ROWS.map(r => ({ ...r })),
  };

  const ratingMethod = rt.method === 'fixed' ? 'fixed' : 'table';

  const sectionsByKey = {
    restraintTypeConvert: renderRestraintTypeConvertSection(rtc),

    pipingClass: enrSection('pipingClass', 'PipingClass — regex from LINE_ID', pc.enabled, `
      <div class="enr-row">
        ${enrField('pipingClass.regex', 'Regex pattern', pc.regex, 'text', '([0-9]{5})')}
        ${enrField('pipingClass.group', 'Group #', pc.group, 'number', '1', 'min="0" max="9"')}
      </div>
      <div class="enr-row">
        ${enrField('pipingClass.tokenPosition', 'Token position (fallback)', pc.tokenPosition, 'number', '4', 'min="1"')}
        ${enrField('pipingClass.tokenDelimiter', 'Delimiter', pc.tokenDelimiter, 'text', '-')}
      </div>
      <p class="enr-hint">Regex is applied to LINE_ID (set by sideload table 1). Capture group is extracted. Token position is used as fallback when regex has no match.</p>
    `),

    rating: enrSection('rating', 'Rating — derived from PipingClass', rt.enabled, `
      <div class="enr-radio-group">
        <label><input type="radio" name="enr-rating-method" data-enr-field="rating.method" value="table" ${ratingMethod !== 'fixed' ? 'checked' : ''}> Lookup table</label>
        <label><input type="radio" name="enr-rating-method" data-enr-field="rating.method" value="fixed" ${ratingMethod === 'fixed' ? 'checked' : ''}> Fixed value</label>
      </div>
      ${ratingMethod === 'fixed'
        ? enrField('rating.fixedValue', 'Fixed rating', rt.fixedValue, 'text', '900')
        : enrTextarea('rating.tableText', 'PipingClass → Rating (tab-separated, one row per line)', rt.tableText, 'PipingClass\tRating\n91261\t900\nS8810104\t150')
      }
    `),

    componentType: enrSection('componentType', 'ComponentType — detected from XML structure', ct.enabled, `
      <div class="enr-comp-grid">
        <code>&lt;BEND&gt;</code><span class="enr-arrow">→</span>${enrSelect('componentType.bendType', '', ct.bendType, COMP_TYPES)}
        <code>&lt;SIF&gt;</code><span class="enr-arrow">→</span>${enrSelect('componentType.sifType', '', ct.sifType, COMP_TYPES)}
        <code>&lt;RIGID&gt;</code><span class="enr-arrow">→</span>${enrSelect('componentType.rigidType', '', ct.rigidType, COMP_TYPES)}
        <span class="enr-default-label">Default (plain pipe)</span><span class="enr-arrow">→</span>${enrSelect('componentType.defaultType', '', ct.defaultType, COMP_TYPES)}
      </div>
    `),

    dtxr: enrSection('dtxr', 'DTXR_POS / DTXR_PS — from RESTRAINT TYPE mapping', dtxr.enabled, `
      ${enrTextarea('dtxr.typeMapText', 'TYPE → KIND → DTXR_POS (tab-separated, one row per line)', dtxr.typeMapText, 'TYPE\tKIND\tDTXR_POS\n0\tANCHOR\tANCHOR\n3\tREST\tPIPE SUPPORT')}
      <p class="enr-hint">Maps the CII source RESTRAINT TYPE number to a support description. Both DTXR_POS and DTXR_PS are set to the same value. First active restraint TYPE per element is used.</p>
    `),

    position: enrSection('position', 'Position — accumulated from DELTA X/Y/Z', pos.enabled, `
      <div class="enr-row enr-row-3">
        ${enrField('position.startX', 'Start node X', pos.startX, 'number', '0')}
        ${enrField('position.startY', 'Start node Y', pos.startY, 'number', '0')}
        ${enrField('position.startZ', 'Start node Z', pos.startZ, 'number', '0')}
      </div>
      <p class="enr-hint">Enter the absolute coordinates of the first pipeline node (from E3D). DELTA values are accumulated along the run. Values of −1.0101 are treated as 0 mm.</p>
    `),

    pointPropertiesBasis: enrSection('pointPropertiesBasis', 'Point_properties_basis — fixed child element', ppb.enabled, `
      <div class="enr-row">
        ${enrField('pointPropertiesBasis.value', 'Value', ppb.value, 'text', 'TO')}
      </div>
      <p class="enr-hint">Adds &lt;Point_properties_basis&gt; to every PIPINGELEMENT. The value is always "TO" per CII 2019 convention.</p>
    `),
  };

  const enabledByKey = {
    restraintTypeConvert: rtc.enabled,
    pipingClass:          pc.enabled,
    rating:               rt.enabled,
    componentType:        ct.enabled,
    dtxr:                 dtxr.enabled,
    position:             pos.enabled,
    pointPropertiesBasis: ppb.enabled,
  };

  const tabBar = ENR_TABS.map(tab => {
    const isActive = tab.key === activeTab;
    const hasEnabled = tab.sectionKeys.some(k => enabledByKey[k]);
    return `<button type="button" class="enr-tab-btn${isActive ? ' is-active' : ''}" data-xml-compare-action="enr-switch-tab" data-enr-tab-key="${esc(tab.key)}">
      <span class="enr-tab-dot${hasEnabled ? ' is-on' : ''}"></span>${esc(tab.label)}
    </button>`;
  }).join('');

  const activeTabDef = ENR_TABS.find(t => t.key === activeTab) || ENR_TABS[0];
  const tabContent = activeTabDef.sectionKeys.map(k => sectionsByKey[k]).join('\n');

  return `<div class="enr-backdrop" data-xml-compare-enrichment-popup>
  <section class="enr-dialog" role="dialog" aria-modal="true" aria-label="Enrichment Config">
    <header class="enr-dialog-header">
      <div>
        <h3>Enrichment Config</h3>
        <p>Auto-populate derived fields when sideload tables are applied.</p>
      </div>
      <button type="button" data-xml-compare-action="close-enrichment">Close</button>
    </header>
    <nav class="enr-tab-bar" role="tablist">${tabBar}</nav>
    <div class="enr-dialog-body">
      ${tabContent}
    </div>
    <footer class="enr-dialog-footer">
      <p class="enr-footer-note">Config is saved to browser localStorage. Enrichment runs when "Apply to loaded XML" is clicked in the Sideload panel.</p>
      <div class="enr-footer-actions">
        <button type="button" data-xml-compare-action="close-enrichment">Cancel</button>
        <button type="button" data-xml-compare-action="save-enrichment" class="enr-btn-primary">Save Config</button>
      </div>
    </footer>
  </section>
</div>`;
}

export const _test = Object.freeze({ esc, enrField, enrSelect, enrTextarea, enrSection, createEnrichmentConfig, DEFAULT_RESTRAINT_TYPE_CONVERT_ROWS, ENR_TABS });
