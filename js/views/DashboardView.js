/**
 * DASHBOARD VIEW — DashboardView.js
 * Owned by: Arlem Tinambacan
 *
 * Displays the user's financial overview:
 *   • Summary cards (total expenses, collected, to collect, pending)
 *   • Recent expenses list
 *   • Outstanding payments
 *   • Quick-action button to add an expense
 *
 * This view must NEVER import model.js or mutate state.
 */

import View from './View.js';

class DashboardView extends View {
  _parentElement = document.getElementById('dashboard-view');

  // ─── Handler registration ──────────────────────────────────────

  /** Subscribe to the initial render event (called on page load). */
  addHandlerRender(handler) {
    // The controller calls this once; the handler is stored for later use.
    this._renderHandler = handler;
  }

  /** Subscribe to the "Add Expense" quick-action button. */
  addHandlerAddExpense(handler) {
    this._parentElement.addEventListener('click', e => {
      const btn = e.target.closest('.btn-add-expense');
      if (btn) handler();
    });
  }

  /** Subscribe to navigation links inside the dashboard. */
  addHandlerNavigate(handler) {
    this._parentElement.addEventListener('click', e => {
      const link = e.target.closest('[data-navigate]');
      if (link) {
        e.preventDefault();
        handler(link.dataset.navigate);
      }
    });
  }

  // ─── Markup ────────────────────────────────────────────────────

  /**
   * Expected data shape:
   * {
   *   summary: { totalExpenses, totalCollected, totalToCollect, pendingPayments, expenseCount },
   *   recentExpenses: [ { id, name, date, amount, participants, progressPct, progressColor } ],
   *   outstanding: [ { participantName, expenseName, share, remaining, status } ]
   * }
   */
  _generateMarkup() {
    const { summary, recentExpenses, outstanding } = this._data;

    return `
      <!-- Welcome -->
      <div class="welcome">
        <h2>Welcome back!</h2>
        <p>Here's your shared expense overview.</p>
      </div>

      <!-- Summary Cards -->
      <div class="summary-cards">
        ${this._summaryCard('Total Shared Expenses', summary.totalExpenses, 'blue',
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
             <line x1="12" y1="1" x2="12" y2="23"/>
             <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
           </svg>`)}
        ${this._summaryCard('Total Collected', summary.totalCollected, 'green',
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
             <polyline points="20 6 9 17 4 12"/>
           </svg>`)}
        ${this._summaryCard('To Collect', summary.totalToCollect, 'orange',
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
             <circle cx="12" cy="12" r="10"/>
             <line x1="12" y1="8" x2="12" y2="12"/>
             <line x1="12" y1="16" x2="12.01" y2="16"/>
           </svg>`)}
        ${this._summaryCardCount('Pending Payments', summary.pendingPayments, 'red',
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
             <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
             <circle cx="9" cy="7" r="4"/>
             <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
             <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
           </svg>`)}
      </div>

      <!-- Two-column grid -->
      <div class="dashboard-grid">
        <!-- Recent Expenses -->
        <div class="card">
          <div class="section-header">
            <h3>Recent Expenses</h3>
            <a href="#" class="btn-small" data-navigate="expenses">View All</a>
          </div>
          ${recentExpenses.length === 0
            ? this._emptyState('No expenses recorded yet.')
            : this._recentExpensesTable(recentExpenses)}
        </div>

        <!-- Outstanding Payments -->
        <div class="card">
          <div class="section-header">
            <h3>Outstanding Payments</h3>
            <a href="#" class="btn-small" data-navigate="payments">View All</a>
          </div>
          ${outstanding.length === 0
            ? this._emptyState('All payments are up to date!')
            : this._outstandingTable(outstanding)}
        </div>
      </div>

      <!-- Quick action -->
      <div style="margin-top:24px; text-align:center;">
        <button class="btn-primary btn-add-expense">+ Add New Expense</button>
      </div>
    `;
  }

  // ─── Partial markup helpers ────────────────────────────────────

  _summaryCard(label, amount, color, iconSvg) {
    return `
      <div class="summary-card">
        <div class="icon-circle icon-${color}">${iconSvg}</div>
        <span class="label">${label}</span>
        <span class="value">${this._formatCurrency(amount)}</span>
      </div>`;
  }

  _summaryCardCount(label, count, color, iconSvg) {
    return `
      <div class="summary-card">
        <div class="icon-circle icon-${color}">${iconSvg}</div>
        <span class="label">${label}</span>
        <span class="value">${count}</span>
      </div>`;
  }

  _recentExpensesTable(expenses) {
    const rows = expenses.map(exp => {
      const progressColor =
        exp.progressPct >= 100 ? 'green' : exp.progressPct > 0 ? 'orange' : 'red';
      return `
        <tr>
          <td>
            <strong>${exp.name}</strong>
            <span class="cell-sub">${this._formatDate(exp.date)}</span>
          </td>
          <td>${this._formatCurrency(exp.amount)}</td>
          <td>
            <div class="progress-bar">
              <div class="progress-fill progress-${progressColor}"
                   style="width:${Math.min(exp.progressPct, 100)}%"></div>
            </div>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Expense</th><th>Amount</th><th>Paid</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  _outstandingTable(items) {
    const rows = items.slice(0, 6).map(item => {
      const badgeClass =
        item.status === 'Unpaid' ? 'badge-unpaid'
        : item.status === 'Partially Paid' ? 'badge-partial'
        : 'badge-paid';
      return `
        <tr>
          <td>
            <strong>${item.participantName}</strong>
            <span class="cell-sub">${item.expenseName}</span>
          </td>
          <td>${this._formatCurrency(item.remaining)}</td>
          <td><span class="badge ${badgeClass}">${item.status}</span></td>
        </tr>`;
    }).join('');

    return `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Participant</th><th>Balance</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  _emptyState(msg) {
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12
                   a2 2 0 0 0 2-2V9z"/>
          <polyline points="13 2 13 9 20 9"/>
        </svg>
        <p>${msg}</p>
      </div>`;
  }
}

export default new DashboardView();

