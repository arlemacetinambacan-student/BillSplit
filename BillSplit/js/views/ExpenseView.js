/**
 * EXPENSE VIEW — ExpenseView.js
 * Owned by: Von Philippe Cabrera
 *
 * Manages shared expense records:
 *   • List / search / filter expenses
 *   • Add / Edit / Delete expense (via modal form)
 *   • Participant rows with equal or custom split
 *   • Form validation (displayed through the View)
 *
 * This view must NEVER import model.js or mutate state.
 */

import View from './View.js';

class ExpenseView extends View {
  _parentElement = document.getElementById('expense-view');

  // Modal & form references
  _modal       = document.getElementById('expense-modal');
  _modalTitle   = document.getElementById('expense-modal-title');
  _form         = document.getElementById('expense-form');
  _formError    = document.getElementById('expense-form-error');
  _editIdInput  = document.getElementById('expense-edit-id');
  _nameInput    = document.getElementById('expense-name');
  _categoryInput= document.getElementById('expense-category');
  _dateInput    = document.getElementById('expense-date');
  _amountInput  = document.getElementById('expense-amount');
  _descInput    = document.getElementById('expense-description');
  _splitTypeInput = document.getElementById('expense-split-type');
  _participantsList = document.getElementById('participants-list');

  // ─── Handler registration ──────────────────────────────────────

  /** Called when the "Add Expense" button is clicked. */
  addHandlerAdd(handler) {
    this._addHandler = handler;
    this._setupFormSubmit();
  }

  /** Called when an expense is being edited (form re-submitted with ID). */
  addHandlerEdit(handler) {
    this._editHandler = handler;
    this._setupFormSubmit();
  }

  /** Single unified submit listener that routes to add or edit based on _editIdInput */
  _setupFormSubmit() {
    if (this._hasSubmitListener) return;
    this._hasSubmitListener = true;

    this._form.addEventListener('submit', e => {
      e.preventDefault();
      const data = this._getFormData();
      if (!data) return;

      const editId = this._editIdInput.value;
      if (editId && this._editHandler) {
        this._editHandler(editId, data);
      } else if (this._addHandler) {
        this._addHandler(data);
      }
    });
  }

  /** Called when the delete button on a card is clicked. */
  addHandlerDelete(handler) {
    this._parentElement.addEventListener('click', e => {
      const btn = e.target.closest('.btn-delete-expense');
      if (!btn) return;
      const id = btn.dataset.id;
      handler(id);
    });
  }

  /** Called when the edit button on a card is clicked. */
  addHandlerEditClick(handler) {
    this._parentElement.addEventListener('click', e => {
      const btn = e.target.closest('.btn-edit-expense');
      if (!btn) return;
      const id = btn.dataset.id;
      handler(id);
    });
  }

  /**
   * Called when the user changes the total amount or participant count
   * so the Controller can ask the Model for the equal-split result.
   */
  addHandlerCalculate(handler) {
    this._calculateHandler = handler;

    // Listen for amount changes
    this._amountInput.addEventListener('input', () => this._requestCalculation());
  }

  /** Allow the controller to trigger navigation to expense view and open form. */
  addHandlerOpenForm(handler) {
    // "Add Expense" button inside the expense list header
    this._parentElement.addEventListener('click', e => {
      const btn = e.target.closest('.btn-open-expense-form');
      if (btn) handler();
    });
  }

  // ─── Public methods for the Controller ─────────────────────────

  /** Open the modal for adding a new expense. */
  openAddForm() {
    this._resetForm();
    this._modalTitle.textContent = 'Add Expense';
    this._addParticipantRow(); // start with one empty row
    this._modal.classList.add('visible');
  }

  /** Open the modal pre-filled for editing an existing expense. */
  openEditForm(expense) {
    this._resetForm();
    this._modalTitle.textContent = 'Edit Expense';
    this._editIdInput.value = expense.id;
    this._nameInput.value = expense.name;
    this._categoryInput.value = expense.category;
    this._dateInput.value = expense.date;
    this._amountInput.value = expense.amount;
    this._descInput.value = expense.description || '';

    // Set split type
    this._setSplitType(expense.splitType);

    // Populate participants
    expense.participants.forEach(p => {
      this._addParticipantRow(p.name, p.share, p.id);
    });

    this._modal.classList.add('visible');
  }

  /** Close the modal and reset. */
  closeForm() {
    this._modal.classList.remove('visible');
    this._resetForm();
  }

  /**
   * Fill share fields for an equal split.
   * @param {number|number[]} shareAmount  One value, or one value per row.
   */
  updateEqualShares(shareAmount) {
    if (this._splitTypeInput.value !== 'equal') return;
    const shares = Array.isArray(shareAmount) ? shareAmount : null;
    const inputs = this._participantsList.querySelectorAll('.participant-share');
    inputs.forEach((inp, i) => {
      const value = shares ? shares[i] : shareAmount;
      inp.value = value === undefined || value === null ? '' : value;
      inp.readOnly = true;
    });
  }

  /** Display a form validation error. */
  showFormError(message) {
    this._formError.textContent = message;
    this._formError.classList.add('visible');
  }

  /** Hide form validation error. */
  hideFormError() {
    this._formError.textContent = '';
    this._formError.classList.remove('visible');
  }

  // ─── Internal helpers ──────────────────────────────────────────

  /** Set up modal UI events (close, split toggle, add/remove participants). */
  initModalEvents() {
    // Close modal
    document.getElementById('expense-modal-close').addEventListener('click', () => this.closeForm());
    document.getElementById('expense-cancel-btn').addEventListener('click', () => this.closeForm());
    this._modal.addEventListener('click', e => {
      if (e.target === this._modal) this.closeForm();
    });

    // Split type toggle
    this._modal.querySelectorAll('.split-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._modal.querySelectorAll('.split-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._splitTypeInput.value = btn.dataset.split;
        this._updateShareInputStates();
        this._requestCalculation();
      });
    });

    // Add participant
    document.getElementById('btn-add-participant').addEventListener('click', () => {
      this._addParticipantRow();
      this._requestCalculation();
    });

    // Remove participant (delegated)
    this._participantsList.addEventListener('click', e => {
      const btn = e.target.closest('.btn-remove-participant');
      if (!btn) return;
      btn.closest('.participant-row').remove();
      this._requestCalculation();
    });
  }

  /** Add a participant input row to the form. */
  _addParticipantRow(name = '', share = '', id = '') {
    const isEqual = this._splitTypeInput.value === 'equal';
    const row = document.createElement('div');
    row.className = 'participant-row';
    row.innerHTML = `
      <input type="text" class="participant-name" placeholder="Name"
             value="${name}" data-participant-id="${id}" />
      <input type="number" class="participant-share" placeholder="Share"
             step="0.01" min="0" value="${share}"
             ${isEqual ? 'readonly' : ''} />
      <button type="button" class="btn-remove-participant" title="Remove">&times;</button>
    `;
    this._participantsList.appendChild(row);

    // Listen for changes on custom share inputs
    const shareInput = row.querySelector('.participant-share');
    shareInput.addEventListener('input', () => {
      // no auto-calc needed for custom — user types manually
    });
  }

  /** Reset the entire form to blank. */
  _resetForm() {
    this._form.reset();
    this._editIdInput.value = '';
    this._participantsList.innerHTML = '';
    this._splitTypeInput.value = 'equal';
    this._setSplitType('equal');
    this.hideFormError();
    // Reset date to today
    this._dateInput.value = new Date().toISOString().split('T')[0];
  }

  /** Visually set the split-type toggle. */
  _setSplitType(type) {
    this._splitTypeInput.value = type;
    this._modal.querySelectorAll('.split-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.split === type);
    });
    this._updateShareInputStates();
  }

  /** Make share inputs readonly (equal) or editable (custom). */
  _updateShareInputStates() {
    const isEqual = this._splitTypeInput.value === 'equal';
    this._participantsList.querySelectorAll('.participant-share').forEach(inp => {
      inp.readOnly = isEqual;
      if (isEqual) inp.value = ''; // will be filled by controller
    });
  }

  /** Ask the controller to recalculate equal shares. */
  _requestCalculation() {
    if (!this._calculateHandler) return;
    const amount = Number(this._amountInput.value) || 0;
    const count = this._participantsList.querySelectorAll('.participant-row').length;
    const splitType = this._splitTypeInput.value;
    this._calculateHandler({ amount, participantCount: count, splitType });
  }

  /** Read all form data. Returns null if validation fails within the View. */
  _getFormData() {
    this.hideFormError();

    const name = this._nameInput.value.trim();
    const category = this._categoryInput.value;
    const date = this._dateInput.value;
    const amount = Number(this._amountInput.value);
    const description = this._descInput.value.trim();
    const splitType = this._splitTypeInput.value;

    // Gather participants
    const rows = this._participantsList.querySelectorAll('.participant-row');
    const participants = [];
    let hasEmptyName = false;
    let hasInvalidShare = false;
    rows.forEach(row => {
      const pName = row.querySelector('.participant-name').value.trim();
      const pShare = Number(row.querySelector('.participant-share').value);
      const pId = row.querySelector('.participant-name').dataset.participantId || '';
      if (!pName) hasEmptyName = true;
      if (isNaN(pShare) || pShare <= 0) hasInvalidShare = true;
      participants.push({ name: pName, share: pShare, id: pId });
    });

    // ── Validation ──
    if (!name) {
      this.showFormError('Please enter an expense name.');
      return null;
    }
    if (!amount || amount <= 0) {
      this.showFormError('The amount must be greater than zero.');
      return null;
    }
    if (participants.length === 0) {
      this.showFormError('Please add at least one participant.');
      return null;
    }
    if (hasEmptyName) {
      this.showFormError('Participant names cannot be empty.');
      return null;
    }
    if (hasInvalidShare) {
      this.showFormError('Individual contributions must be valid positive amounts.');
      return null;
    }

    // Check that contributions sum equals total amount (allow slight rounding margin up to 0.05)
    const total = participants.reduce((s, p) => s + p.share, 0);
    if (Math.abs(total - amount) > 0.05) {
      this.showFormError(
        `The participant contributions (${this._formatCurrency(total)}) must equal the total expense (${this._formatCurrency(amount)}).`
      );
      return null;
    }

    return { name, category, date, amount, description, splitType, participants };
  }

  // ─── Markup ────────────────────────────────────────────────────

  /**
   * Expected data shape:
   * {
   *   expenses: [ { id, name, category, amount, date, description,
   *                  splitType, participants, progressPct, paid, total } ],
   *   searchTerm: string,
   *   categoryFilter: string
   * }
   */
  _generateMarkup() {
    const { expenses, searchTerm = '', categoryFilter = '' } = this._data;

    // Filter
    let filtered = expenses;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      filtered = filtered.filter(e => e.category === categoryFilter);
    }

    // Unique categories for filter dropdown
    const categories = [...new Set(expenses.map(e => e.category))];

    return `
      <div class="section-header">
        <h2>Expenses</h2>
        <button class="btn-primary btn-open-expense-form">+ Add Expense</button>
      </div>

      <div class="expense-filters">
        <input type="text" placeholder="Search expenses..." class="expense-search"
               value="${searchTerm}" />
        <select class="expense-category-filter">
          <option value="">All Categories</option>
          ${categories.map(c => `<option value="${c}" ${c === categoryFilter ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>

      ${filtered.length === 0
        ? `<div class="empty-state">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round">
               <circle cx="12" cy="12" r="10"/>
               <line x1="12" y1="8" x2="12" y2="12"/>
               <line x1="12" y1="16" x2="12.01" y2="16"/>
             </svg>
             <p>${searchTerm || categoryFilter ? 'No matching expenses found.' : 'No expenses yet. Click "+ Add Expense" to get started!'}</p>
           </div>`
        : `<div class="expense-cards">
             ${filtered.map(exp => this._expenseCard(exp)).join('')}
           </div>`}
    `;
  }

  _expenseCard(exp) {
    const progressColor =
      exp.progressPct >= 100 ? 'green' : exp.progressPct > 0 ? 'orange' : 'red';
    const participantNames = exp.participants.map(p => p.name).join(', ');

    return `
      <div class="expense-card" data-expense-id="${exp.id}">
        <div class="expense-card-header">
          <div>
            <h4>${exp.name}</h4>
            <span class="expense-card-meta">
              <span class="badge badge-category">${exp.category}</span>
              &nbsp;${this._formatDate(exp.date)}
            </span>
          </div>
          <div class="expense-card-actions">
            <button class="btn-icon btn-edit-expense" data-id="${exp.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2
                         2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon danger btn-delete-expense" data-id="${exp.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="expense-card-amount">${this._formatCurrency(exp.amount)}</div>
        ${exp.description ? `<p class="expense-card-meta">${exp.description}</p>` : ''}
        <div class="expense-card-participants">
          <strong>${exp.participants.length}</strong> participant${exp.participants.length !== 1 ? 's' : ''}: ${participantNames}
        </div>
        <div class="expense-card-progress">
          <div class="progress-label">${this._formatCurrency(exp.paid)} / ${this._formatCurrency(exp.amount)} collected</div>
          <div class="progress-bar">
            <div class="progress-fill progress-${progressColor}"
                 style="width:${Math.min(exp.progressPct, 100)}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Search & filter (internal UI, delegates re-render to controller) ──

  /** Register filter change handlers that call the controller re-render. */
  addHandlerFilter(handler) {
    this._parentElement.addEventListener('input', e => {
      if (e.target.matches('.expense-search')) {
        handler({
          searchTerm: e.target.value,
          categoryFilter: this._parentElement.querySelector('.expense-category-filter')?.value || ''
        });
      }
    });
    this._parentElement.addEventListener('change', e => {
      if (e.target.matches('.expense-category-filter')) {
        handler({
          searchTerm: this._parentElement.querySelector('.expense-search')?.value || '',
          categoryFilter: e.target.value
        });
      }
    });
  }
}

export default new ExpenseView();

