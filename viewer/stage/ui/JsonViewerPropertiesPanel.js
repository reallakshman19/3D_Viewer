function itemFor(model, selectedRef) {
  if (!model || !selectedRef) return null;
  if (selectedRef.type === 'root') return { type: 'root', id: selectedRef.id, schema: model.schema, source: model.source };
  if (selectedRef.type === 'node') return model.hierarchy?.nodes?.find((node) => node.id === selectedRef.id) || null;
  if (selectedRef.type === 'component') return model.components?.find((component) => component.id === selectedRef.id) || null;
  if (selectedRef.type === 'primitive') return model.primitives?.find((primitive) => primitive.id === selectedRef.id) || null;
  return null;
}

function displayValue(value) {
  if (Array.isArray(value)) return value.length > 6 ? `${value.length} items` : value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

function rowsFor(item) {
  const keys = ['id', 'name', 'path', 'kind', 'semanticType', 'ownerPath', 'nodeId', 'type', 'schema'];
  const rows = keys.filter((key) => key in item).map((key) => [key, item[key]]);
  if (item.primitiveIds) rows.push(['primitive count', item.primitiveIds.length]);
  if (item.bboxWorld) rows.push(['bboxWorld', item.bboxWorld]);
  if (item.confidence) rows.push(['confidence', item.confidence]);
  if (item.renderPolicy) rows.push(['renderPolicy', item.renderPolicy]);
  if (item.source) rows.push(['source', item.source]);
  return rows;
}

export function renderProperties(target, model, selectedRef) {
  target.replaceChildren();
  const item = itemFor(model, selectedRef);
  if (!item) {
    const empty = document.createElement('div');
    empty.className = 'json-viewer-empty-state';
    empty.textContent = 'Select a hierarchy row to view properties';
    target.appendChild(empty);
    return;
  }

  const title = document.createElement('h2');
  title.className = 'json-viewer-panel-title';
  title.textContent = 'Properties';
  const table = document.createElement('dl');
  table.className = 'json-viewer-property-list';
  for (const [key, value] of rowsFor(item)) {
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = displayValue(value);
    table.append(dt, dd);
  }
  target.append(title, table);
}
