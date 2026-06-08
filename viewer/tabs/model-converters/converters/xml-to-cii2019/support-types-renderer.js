export function renderSupportTypes(container, supportConfig, callbacks) {
  // Support mapping workflow isolated entirely. No duplicate steps exist.
  container.innerHTML = `
    <div class="support-types-renderer">
      <h3>Support Type Mapping</h3>
      <p>Configure mapping logic here.</p>
    </div>
  `;
}
