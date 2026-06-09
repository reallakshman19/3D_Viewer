/**
 * Reusable modal component for conversion workflows.
 * Handles viewport confinement, sticky headers, backdrop clicks, close events, and body scroll locking.
 */
export class WorkflowModal {
  /**
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {string} [options.subtitle] - Modal header subtitle
   * @param {Array<{id: string, label: string, state?: string}>} [options.tabs] - Optional array of tabs
   * @param {string} [options.activeTabId] - Currently active tab
   * @param {function(string)} [options.onTabChange] - Tab selection callback
   * @param {function()} [options.onClose] - Close callback
   */
  constructor({ title, subtitle = '', tabs = [], activeTabId = '', onTabChange = () => {}, onClose = () => {} }) {
    this.title = title;
    this.subtitle = subtitle;
    this.tabs = tabs;
    this.activeTabId = activeTabId;
    this.onTabChange = onTabChange;
    this.onClose = onClose;

    this.overlayEl = null;
    this.bodyEl = null;
  }

  /**
   * Opens the modal and locking body scroll.
   * @returns {HTMLElement} The body container element for custom rendering.
   */
  open() {
    if (this.overlayEl) return this.bodyEl;

    // Lock body scroll
    document.body.style.overflow = 'hidden';

    const overlay = document.createElement('div');
    overlay.className = 'model-converters-workflow-popup-overlay';
    
    overlay.innerHTML = `
      <div class="model-converters-workflow-popup" role="dialog" aria-modal="true" aria-label="${this.title}">
        <div class="model-converters-workflow-popup-head">
          <div>
            <div class="model-converters-workflow-popup-title">${this.title}</div>
            ${this.subtitle ? `<div class="model-converters-workflow-detail-text">${this.subtitle}</div>` : ''}
          </div>
          <button type="button" class="model-converters-download-btn model-converters-workflow-popup-close" data-modal-close>Close</button>
        </div>
        ${this.tabs.length ? `
          <div class="model-converters-workflow-popup-tabs">
            ${this.tabs.map(t => `
              <button type="button" class="model-converters-workflow-phase ${t.id === this.activeTabId ? 'is-active' : ''}" data-modal-tab="${t.id}" data-xml-cii-phase="${t.id}">
                <span>${t.label}</span>
                ${t.state ? `<small>${t.state}</small>` : ''}
              </button>
            `).join('')}
          </div>
        ` : ''}
        <div class="model-converters-workflow-popup-body" data-modal-body></div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlayEl = overlay;
    this.bodyEl = overlay.querySelector('[data-modal-body]');

    // Bind close listeners
    overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    // Bind tab listeners
    if (this.tabs.length) {
      overlay.querySelectorAll('[data-modal-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tabId = btn.dataset.modalTab;
          this.setActiveTab(tabId);
          this.onTabChange(tabId);
        });
      });
    }

    return this.bodyEl;
  }

  /**
   * Sets the active tab visually.
   * @param {string} tabId 
   */
  setActiveTab(tabId) {
    this.activeTabId = tabId;
    if (!this.overlayEl) return;
    this.overlayEl.querySelectorAll('[data-modal-tab]').forEach(btn => {
      if (btn.dataset.modalTab === tabId) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });
  }

  /**
   * Closes the modal and restores scroll.
   */
  close() {
    if (!this.overlayEl) return;

    // Restore scroll
    document.body.style.overflow = '';

    this.overlayEl.remove();
    this.overlayEl = null;
    this.bodyEl = null;

    if (typeof this.onClose === 'function') {
      this.onClose();
    }
  }
}
