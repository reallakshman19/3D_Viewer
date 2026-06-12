const PROJECTION_OPTIONS = [
  { value: '3d', label: '3D model coordinates' },
  { value: 'top', label: 'Top / plan (X-Y)' },
  { value: 'elevation-xz', label: 'Elevation X-Z' },
  { value: 'elevation-yz', label: 'Elevation Y-Z' },
  { value: 'iso-2.5d', label: 'Isometric 2.5D' },
];

function injectProjectionSelect(container) {
  const branchRow = container.querySelector('[data-option-key="selectedBranches"]');
  if (!branchRow) return;
  const parent = branchRow.closest('.converter-options') || branchRow.parentElement;
  if (!parent || parent.querySelector('[data-option-key="projectionMode"]')) return;

  const row = document.createElement('div');
  row.className = 'option-row';
  row.dataset.optionKey = 'projectionMode';

  const label = document.createElement('label');
  label.textContent = 'Projection mode';

  const select = document.createElement('select');
  select.name = 'projectionMode';
  for (const opt of PROJECTION_OPTIONS) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    select.appendChild(el);
  }

  row.appendChild(label);
  row.appendChild(select);
  branchRow.insertAdjacentElement('afterend', row);
}

export function installInputXmlDxfProjectionOption(container) {
  if (!container) return () => {};

  const observer = new MutationObserver(() => injectProjectionSelect(container));
  observer.observe(container, { childList: true, subtree: true });
  injectProjectionSelect(container);

  return () => observer.disconnect();
}
