/**
 * VIEW BASE CLASS — View.js
 * Provides reusable rendering, error display, and handler-registration
 * methods that every concrete view inherits.
 *
 * Views must NEVER import model.js or mutate application state.
 */

export default class View {
  _data;
  _parentElement;

  // ─── Core rendering ──────────────────────────────────────────────

  /**
   * Render the view with the given data.
   * Clears the parent element and inserts the new markup.
   * @param {*} data  Data object (shape depends on the concrete view)
   */
  render(data) {
    this._data = data;
    const markup = this._generateMarkup();
    this._clear();
    this._parentElement.insertAdjacentHTML('afterbegin', markup);
  }

  /** Remove all child content from the parent element. */
  _clear() {
    this._parentElement.innerHTML = '';
  }

  /**
   * Generate the HTML string for this view.
   * Must be overridden by every concrete view.
   * @returns {string}
   */
  _generateMarkup() {
    return '';
  }

  // ─── Error messages ──────────────────────────────────────────────

  /**
   * Display an inline error message inside a target element.
   * @param {string} message  The error text
   * @param {HTMLElement} [container]  Element to show the error in.
   *        Defaults to a `.form-error` inside the parent element.
   */
  displayError(message, container) {
    const el =
      container || this._parentElement.querySelector('.form-error');
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
  }

  /**
   * Hide any currently displayed error message.
   * @param {HTMLElement} [container]
   */
  clearError(container) {
    const el =
      container || this._parentElement.querySelector('.form-error');
    if (!el) return;
    el.textContent = '';
    el.classList.remove('visible');
  }

  // ─── Visibility helpers ──────────────────────────────────────────

  /** Show this view's section. */
  show() {
    this._parentElement.classList.add('active');
  }

  /** Hide this view's section. */
  hide() {
    this._parentElement.classList.remove('active');
  }

  /** Return the parent DOM element. */
  getElement() {
    return this._parentElement;
  }

  // ─── Utility ─────────────────────────────────────────────────────

  /**
   * Format a number as ₱ Philippine Peso.
   * (Display-only helper — no business logic.)
   */
  _formatCurrency(amount) {
    const num = Number(amount) || 0;
    return `₱${num.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Format an ISO date string to a human-readable form.
   * @param {string} dateStr  e.g. "2026-11-09"
   * @returns {string}  e.g. "Nov 9, 2026"
   */
  _formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

