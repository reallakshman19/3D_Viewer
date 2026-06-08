export function renderConverterSelector(container, context) {
  const { CONVERTERS, getConverterById } = context;

  const html = `
    <div class="model-converters-card">
      <div class="model-converters-card-title">Converter</div>
      <label class="model-converters-label">
        <select class="model-converters-select model-converters-main-select">
          ${CONVERTERS.map((def) => `
            <option value="${def.id}" ${def.id === context.selectedConverter ? 'selected' : ''} ${def.disabled ? 'disabled' : ''}>${def.label}</option>
          `).join('')}
        </select>
      </label>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);

  const select = container.querySelector('.model-converters-main-select');
  select.addEventListener('change', () => {
    context.onChange(select.value);
  });
}
