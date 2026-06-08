export const BRANCH_COLUMNS = [
  { key: 'branchName', label: 'Branch Name' },
  { key: 'lineKey', label: 'Line Key' },
  { key: 'size', label: 'Size' },
  { key: 'pipingClass', label: 'Piping Class', editable: true },
  { key: 'material', label: 'Material' },
  { key: 'rating', label: 'Rating' },
  { key: 'materialCode', label: 'Mat. Code', editable: true },
  { key: 'p1', label: 'P1 (MPa)', editable: true },
  { key: 't1', label: 'T1 (C)', editable: true },
  { key: 't2', label: 'T2 (C)', editable: true },
  { key: 't3', label: 'T3 (C)', editable: true },
  { key: 'hydroPressure', label: 'Hydro Test Pressure', editable: true },
  { key: 'density', label: 'Density', editable: true },
  { key: 'wallThickness', label: 'Wall Thk', editable: true },
  { key: 'corrosion', label: 'Corrosion', editable: true },
  { key: 'weightSummary', label: 'Wt' }
];

export const NODE_COLUMNS = [
  { key: 'nodeNumber', label: 'Node' },
  { key: 'componentType', label: 'Type' },
  { key: 'boreMm', label: 'Bore' },
  { key: 'rating', label: 'Rating' },
  { key: 'lengthMm', label: 'Length' },
  { key: 'dtxr', label: 'DTXR' },
  { key: 'xmlWeight', label: 'Weight' },
  { key: 'deltaLength', label: 'ΔLen' },
  { key: 'candidates', label: 'All Candidates' }
];

export function renderPreviewModel(container, previewModel) {
  // Rendering logic respecting columns strictly.
}
