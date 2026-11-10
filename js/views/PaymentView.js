/**
 * PAYMENT VIEW — PaymentView.js
 * Owned by: Janslee Matucol
 *
 * Monitors payments made by participants:
 *   • Summary totals (collected, outstanding)
 *   • Participant payment table with status badges
 *   • Record / Update / Delete payment actions
 *   • Validation feedback
 *
 * This view must NEVER import model.js or mutate state.
 */

import View from './View.js';

class PaymentView extends View {
  _parentElement = document.getElementById('payment-view');

  // Modal & form references
  _modal          = document.getElementById('payment-modal');
  _modalTitle      = document.getElementById('payment-modal-title');
  _form            = document.getElementById('payment-form');
  _formError       = document.getElementById('payment-form-error');
  _expenseIdInput  = document.getElementById('payment-expense-id');
  _participantIdInput = document.getElementById('payment-participant-id');
  _editIdInput     = document.getElementById('payment-edit-id');
  _participantName = document.getElementById('payment-participant-name');
  _expenseName     = document.getElementById('payment-expense-name');
  _shareDisplay    = document.getElementById('payment-share');
  _remainingDisplay= document.getElementById('payment-remaining');
  _amountInput     = document.getElementById('payment-amount');
  _dateInput       = document.getElementById('payment-date');

  // ─── Handler registration ──────────────────────────────────────

  /** Subscribe to new payment submission. */
  addHandlerRecordPayment(handler) {
    this._recordHandler = handler;
    this._form.addEventListener('submit', e => {
      e.preventDefault();
      const data = this._getFormData();
      if (data) handler(data);
    });
  }

  /** Subscribe to the "Record Payment" button on each row (delegated). */
  addHandlerOpenPaymentForm(handler) {
    this._parentElement.addEventListener('click', e => {
      const btn = e.target.closest('.btn-record-payment');
      if (!btn) return;
      handler({
        expenseId: btn.dataset.expenseId,
        participantId: btn.dataset.participantId,
      });
    });
  }

  /** Subscribe to the delete-payment button on individual payment rows. */
  addHandlerDeletePayment(handler) {
    this._parentElement.addEventListener('click', e => {
      const btn = e.target.closest('.btn-delete-payment');
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }

  /** Subscribe to a filter change. */
  addHandlerFilter(handler) {
    this._parentElement.addEventListener('change', e => {
      if (e.target.matches('.payment-status-filter')) {
        handler({ statusFilter: e.target.value });
      }
    });
    this._parentElement.addEventListener('input', e => {
      if (e.target.matches('.payment-search')) {
        handler({ searchTerm: e.target.value });
      }
    });
  }

  // ─── Public methods for the Controller ─────────────────────────

  /**
   * Open the payment modal pre-filled with participant context.
   * @param {Object} info  { participantName, expenseName, share, remaining,
   *                         expenseId, participantId }
   */
  openPaymentForm(info) {
    this._resetForm();
    this._modalTitle.textContent = 'Record Payment';
    this._expenseIdInput.value     = info.expenseId;
    this._participantIdInput.value = info.participantId;
    this._participantName.value    = info.participantName;
    this._expenseName.value        = info.expenseName;
    this._shareDisplay.value       = this._formatCurrency(info.share);
    this._remainingDisplay.value   = this._formatCurrency(info.remaining);
    this._amountInput.max          = info.remaining;
    this._amountInput.value        = '';
    this._dateInput.value = new Date().toISOString().split('T')[0];
    this._modal.classList.add('visible');
  }

  /** Close the payment modal. */
  closeForm() {
    this._modal.classList.remove('visible');
    this._resetForm();
  }

  /** Show a form validation error in the payment modal. */
  showFormError(message) {
    this._formError.textContent = message;
    this._formError.classList.add('visible');
  }

  /** Hide form error. */
  hideFormError() {
    this._formError.textContent = '';
    this._formError.classList.remove('visible');
  }

  /** One-time setup for modal close events. */
  initModalEvents() {
    document.getElementById('payment-modal-close').addEventListener('click', () => this.closeForm());
    document.getElementById('payment-cancel-btn').addEventListener('click', () => this.closeForm());
    this._modal.addEventListener('click', e => {
      if (e.target === this._modal) this.closeForm();
    });
  }

  // ─── Internal helpers ──────────────────────────────────────────

  _resetForm() {
    this._form.reset();
    this._editIdInput.value = '';
    this._expenseIdInput.value = '';
    this._participantIdInput.value = '';
    this.hideFormError();
  }

  /** Read and validate form data. Returns null on failure. */
  _getFormData() {
    this.hideFormError();

    const expenseId     = this._expenseIdInput.value;
    const participantId = this._participantIdInput.value;
    const editId        = this._editIdInput.value;
    const amount        = Number(this._amountInput.value);
    const date          = this._dateInput.value;

    // Parse remaining from the display field
    const remainingText = this._remainingDisplay.value
      .replace(/[₱,]/g, '')
      .trim();
    const remaining = Number(remainingText) || 0;

    if (!amount || amount <= 0) {
      this.showFormError('Payment amount must be greater than zero.');
      return null;
    }
    if (amount > remaining + 0.01) {
      this.showFormError(
        `Payment cannot exceed the remaining balance of ${this._formatCurrency(remaining)}.`
      );
      return null;
    }
    if (!expenseId || !participantId) {
      this.showFormError('A payment must belong to a valid participant and expense.');
      return null;
    }

    return { expenseId, participantId, amount, date, editId: editId || null };
  }

  // ─── Markup ────────────────────────────────────────────────────

  /**
   * Expected data shape:
   * {
   *   summary: { totalCollected, totalOutstanding },
   *   balances: [ { expenseId, expenseName, expenseCategory, expenseDate,
   *                 participantId, participantName, share, totalPaid,
   *                 remaining, status, payments } ],
   *   statusFilter: string,
   *   searchTerm: string
   * }
   */
  _generateMarkup() {
    const { summary, balances, statusFilter = '', searchTerm = '' } = this._data;

    // Filter balances
    let filtered = balances;
    if (statusFilter) {
      filtered = filtered.filter(b => b.status === statusFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(b =>
        b.participantName.toLowerCase().includes(q) ||
        b.expenseName.toLowerCase().includes(q)
      );
    }

    return `
      <div class="section-header">
        <h2>Payments</h2>
      </div>

      <!-- Summary -->
      <div class="payment-summary">
        <div class="summary-card">
          <div class="icon-circle icon-green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <span class="label">Total Collected</span>
          <span class="value">${this._formatCurrency(summary.totalCollected)}</span>
        </div>
        <div class="summary-card">
          <div class="icon-circle icon-orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <span class="label">Outstanding</span>
          <span class="value">${this._formatCurrency(summary.totalOutstanding)}</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="payment-filters">
        <input type="text" class="payment-search" placeholder="Search participant or expense..."
               value="${searchTerm}" />
        <select class="payment-status-filter">
          <option value="">All Statuses</option>
          <option value="Unpaid" ${statusFilter === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
          <option value="Partially Paid" ${statusFilter === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
          <option value="Fully Paid" ${statusFilter === 'Fully Paid' ? 'selected' : ''}>Fully Paid</option>
        </select>
      </div>

      ${filtered.length === 0
        ? `<div class="card"><div class="empty-state">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round">
               <polyline points="9 11 12 14 22 4"/>
               <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5
                        a2 2 0 0 1 2-2h11"/>
             </svg>
             <p>${statusFilter || searchTerm ? 'No matching records found.' : 'No payment records yet.'}</p>
           </div></div>`
        : `<div class="pay-list">
             ${filtered.map(b => this._balanceCard(b)).join('')}
           </div>`}

      ${this._paymentHistorySection(filtered)}
    `;
  }

  _balanceCard(b) {
    const badgeClass =
      b.status === 'Unpaid' ? 'badge-unpaid'
      : b.status === 'Partially Paid' ? 'badge-partial'
      : 'badge-paid';
    const pct = b.share > 0 ? Math.min((b.totalPaid / b.share) * 100, 100) : 0;
    const progressColor = pct >= 100 ? 'green' : pct > 0 ? 'orange' : 'red';
    const showRecordBtn = b.status !== 'Fully Paid';

    return `
      <article class="pay-card">
        <div class="pay-card-top">
          <span class="person-avatar" aria-hidden="true">${this._initials(b.participantName)}</span>
          <div class="pay-card-who">
            <strong>${b.participantName}</strong>
            <span class="cell-sub">${b.expenseName} · ${this._formatDate(b.expenseDate)}</span>
          </div>
          <span class="badge ${badgeClass}">${b.status}</span>
        </div>
        <div class="pay-card-amounts">
          <div><span>Share</span><strong>${this._formatCurrency(b.share)}</strong></div>
          <div><span>Paid</span><strong>${this._formatCurrency(b.totalPaid)}</strong></div>
          <div><span>Left</span><strong>${this._formatCurrency(b.remaining)}</strong></div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill progress-${progressColor}" style="width:${pct}%"></div>
        </div>
        ${showRecordBtn
          ? `<button class="btn-primary btn-record-payment"
                     data-expense-id="${b.expenseId}"
                     data-participant-id="${b.participantId}">
               Record payment
             </button>`
          : `<p class="pay-settled">Paid in full</p>`}
      </article>
    `;
  }

  _initials(name) {
    const parts = String(name || '').trim().split(/\s+/).slice(0, 2);
    const letters = parts.map(part => part.charAt(0).toUpperCase()).join('');
    return letters || '?';
  }

  /** Show individual payment history grouped under each participant/expense. */
  _paymentHistorySection(balances) {
    // Collect all balances that have at least one payment
    const withPayments = balances.filter(b => b.payments && b.payments.length > 0);
    if (withPayments.length === 0) return '';

    const rows = withPayments.flatMap(b =>
      b.payments.map(pay => `
        <div class="history-row">
          <div>
            <strong>${b.participantName}</strong>
            <span class="cell-sub">${b.expenseName} · ${this._formatDate(pay.date)}</span>
          </div>
          <span class="history-amount">${this._formatCurrency(pay.amount)}</span>
          <button class="btn-icon danger btn-delete-payment" data-id="${pay.id}" title="Delete payment">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      `)
    ).join('');

    return `
      <div class="card history-card">
        <div class="section-header">
          <h3>Payment History</h3>
        </div>
        <div class="history-list">${rows}</div>
      </div>
    `;
  }
}

export default new PaymentView();

