/**
 * CONTROLLER — controller.js
 *
 * The single orchestration layer that connects the Model and the Views.
 *   • Imports the Model and all three Views.
 *   • Subscribes to View handler methods.
 *   • Receives user actions from the Views.
 *   • Calls Model functions.
 *   • Passes updated data back to the Views for re-rendering.
 *
 * The Controller must NEVER build HTML markup itself.
 */

import * as model from './model.js';
import dashboardView from './views/DashboardView.js';
import expenseView   from './views/ExpenseView.js';
import paymentView   from './views/PaymentView.js';

// ─── Current UI state (not persisted — ephemeral) ────────────────
let currentView      = 'dashboard';
let expenseSearch    = '';
let expenseCatFilter = '';
let paymentSearch    = '';
let paymentStatusFilter = '';

// ─── Confirm-delete plumbing ─────────────────────────────────────
const confirmModal   = document.getElementById('confirm-modal');
const confirmTitle   = document.getElementById('confirm-title');
const confirmMsg     = document.getElementById('confirm-message');
const confirmDelBtn  = document.getElementById('confirm-delete-btn');
const confirmCancel  = document.getElementById('confirm-cancel-btn');
const confirmClose   = document.getElementById('confirm-modal-close');
let   pendingDeleteFn = null;

function openConfirm(message, onConfirm, confirmLabel = 'Delete') {
  confirmTitle.textContent = confirmLabel === 'Delete' ? 'Confirm Delete' : 'Please confirm';
  confirmMsg.textContent = message;
  confirmDelBtn.textContent = confirmLabel;
  pendingDeleteFn = onConfirm;
  confirmModal.classList.add('visible');
}
function closeConfirm() {
  confirmModal.classList.remove('visible');
  pendingDeleteFn = null;
}
confirmDelBtn.addEventListener('click', () => {
  if (pendingDeleteFn) pendingDeleteFn();
  closeConfirm();
});
confirmCancel.addEventListener('click', closeConfirm);
confirmClose.addEventListener('click', closeConfirm);
confirmModal.addEventListener('click', e => { if (e.target === confirmModal) closeConfirm(); });

// ─── Navigation ──────────────────────────────────────────────────

const navLinks   = document.querySelectorAll('.nav-link');
const pageTitle  = document.getElementById('page-title');
const pageSub    = document.getElementById('page-subtitle');
const dateEl     = document.getElementById('current-date');

const viewMeta = {
  dashboard: { title: 'Dashboard',  sub: 'Your shared expense overview' },
  expenses:  { title: 'Expenses',   sub: 'Manage your shared expenses' },
  payments:  { title: 'Payments',   sub: 'Track participant payments' },
};

function navigateTo(view) {
  currentView = view;
  navLinks.forEach(l => l.classList.toggle('active', l.dataset.view === view));
  const meta = viewMeta[view] || {};
  pageTitle.textContent = meta.title || '';
  pageSub.textContent   = meta.sub   || '';

  dashboardView.hide();
  expenseView.hide();
  paymentView.hide();

  if (view === 'dashboard') { controlRenderDashboard(); dashboardView.show(); }
  if (view === 'expenses')  { controlRenderExpenses();  expenseView.show();  }
  if (view === 'payments')  { controlRenderPayments();  paymentView.show();  }

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

navLinks.forEach(link =>
  link.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(link.dataset.view);
  })
);

// Mobile sidebar toggle
const hamburger      = document.getElementById('hamburger');
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
hamburger.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('visible');
});
sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
});

// ─── Render helpers ──────────────────────────────────────────────

function controlRenderDashboard() {
  const summary        = model.getExpenseSummary();
  const recentExpenses = model.getRecentExpenses(5).map(exp => {
    const balances  = exp.participants.map(p => model.getParticipantBalance(exp.id, p.id));
    const totalPaid = balances.reduce((s, b) => s + (b ? b.totalPaid : 0), 0);
    const pct       = exp.amount > 0 ? (totalPaid / exp.amount) * 100 : 0;
    return { ...exp, progressPct: pct };
  });
  const outstanding = model.getOutstandingBalance();

  dashboardView.render({ summary, recentExpenses, outstanding });
}

function controlRenderExpenses() {
  const expenses = model.state.expenses.map(exp => {
    const balances  = exp.participants.map(p => model.getParticipantBalance(exp.id, p.id));
    const totalPaid = balances.reduce((s, b) => s + (b ? b.totalPaid : 0), 0);
    const pct       = exp.amount > 0 ? (totalPaid / exp.amount) * 100 : 0;
    return { ...exp, progressPct: pct, paid: totalPaid, total: exp.amount };
  });

  expenseView.render({
    expenses,
    searchTerm: expenseSearch,
    categoryFilter: expenseCatFilter,
  });
}

function controlRenderPayments() {
  const balances = model.getAllParticipantBalances();
  const summary = {
    totalCollected:   balances.reduce((s, b) => s + b.totalPaid, 0),
    totalOutstanding: balances.reduce((s, b) => s + b.remaining, 0),
  };

  paymentView.render({
    summary,
    balances,
    statusFilter: paymentStatusFilter,
    searchTerm: paymentSearch,
  });
}

/** Re-render whichever views are needed after a data change. */
function refreshAll() {
  if (currentView === 'dashboard') controlRenderDashboard();
  if (currentView === 'expenses')  controlRenderExpenses();
  if (currentView === 'payments')  controlRenderPayments();
}

// ─── Expense handlers ────────────────────────────────────────────

function controlAddExpense(data) {
  model.addExpense(data);
  expenseView.closeForm();
  refreshAll();
}

function controlUpdateExpense(id, data) {
  model.updateExpense(id, data);
  expenseView.closeForm();
  refreshAll();
}

function controlDeleteExpense(id) {
  const expense = model.state.expenses.find(e => e.id === id);
  const name = expense ? expense.name : 'this expense';
  openConfirm(
    `Are you sure you want to delete "${name}"? This will also remove all associated payment records.`,
    () => {
      model.deleteExpense(id);
      refreshAll();
    }
  );
}

function controlEditExpenseClick(id) {
  const expense = model.state.expenses.find(e => e.id === id);
  if (!expense) return;
  expenseView.openEditForm(expense);
}

function controlCalculateShares({ amount, participantCount, splitType }) {
  if (splitType !== 'equal') return;
  const shares = model.calculateEqualShares(amount, participantCount);
  expenseView.updateEqualShares(shares);
}

function controlExpenseFilter({ searchTerm, categoryFilter }) {
  expenseSearch    = searchTerm    ?? expenseSearch;
  expenseCatFilter = categoryFilter ?? expenseCatFilter;
  const caret = captureSearchCaret('.expense-search');
  controlRenderExpenses();
  restoreSearchCaret('.expense-search', caret);
}

// ─── Payment handlers ────────────────────────────────────────────

function controlOpenPaymentForm({ expenseId, participantId }) {
  const balance = model.getParticipantBalance(expenseId, participantId);
  if (!balance) return;
  paymentView.openPaymentForm(balance);
}

function controlRecordPayment(data) {
  // Additional validation via model
  const balance = model.getParticipantBalance(data.expenseId, data.participantId);
  if (!balance) {
    paymentView.showFormError('Invalid participant or expense.');
    return;
  }
  if (data.amount > balance.remaining + 0.01) {
    paymentView.showFormError(
      `Payment cannot exceed the remaining balance of ${model.formatCurrency(balance.remaining)}.`
    );
    return;
  }

  if (data.editId) {
    model.updatePayment(data.editId, { amount: data.amount, date: data.date });
  } else {
    model.addPayment(data);
  }

  paymentView.closeForm();
  refreshAll();
}

function controlDeletePayment(id) {
  openConfirm('Are you sure you want to delete this payment record?', () => {
    model.deletePayment(id);
    refreshAll();
  });
}

function controlPaymentFilter({ statusFilter, searchTerm }) {
  if (statusFilter !== undefined)  paymentStatusFilter = statusFilter;
  if (searchTerm   !== undefined)  paymentSearch       = searchTerm;
  const caret = captureSearchCaret('.payment-search');
  controlRenderPayments();
  restoreSearchCaret('.payment-search', caret);
}

/** Remember the caret when a re-render is about to replace the search box. */
function captureSearchCaret(selector) {
  const el = document.activeElement;
  if (!el || !el.matches(selector)) return null;
  return el.selectionStart;
}

function restoreSearchCaret(selector, caret) {
  if (caret === null || caret === undefined) return;
  const input = document.querySelector(selector);
  if (!input) return;
  input.focus();
  const pos = Math.min(caret, input.value.length);
  input.setSelectionRange(pos, pos);
}

// ─── Dashboard handlers ──────────────────────────────────────────

function controlDashboardAddExpense() {
  navigateTo('expenses');
  expenseView.openAddForm();
}

function controlDashboardNavigate(target) {
  navigateTo(target);
}

// ─── Floating Action Button (FAB) for quick add ──────────────────

const fabAdd = document.getElementById('fab-add');
if (fabAdd) {
  fabAdd.addEventListener('click', () => {
    navigateTo('expenses');
    expenseView.openAddForm();
  });
}

// ─── Initialisation ──────────────────────────────────────────────

function controlInit() {
  // Clean up any legacy device-mode class or storage key
  document.body.classList.remove('device-mode');
  try { localStorage.removeItem('billsplit_ui_mode'); } catch (e) {}

  // Load persisted data
  model.loadData();

  // Set current date in top bar
  dateEl.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Initialise modal close events
  expenseView.initModalEvents();
  paymentView.initModalEvents();

  // ── Subscribe to View handlers ──

  // Dashboard
  dashboardView.addHandlerRender(controlRenderDashboard);
  dashboardView.addHandlerAddExpense(controlDashboardAddExpense);
  dashboardView.addHandlerNavigate(controlDashboardNavigate);

  // Expenses
  expenseView.addHandlerAdd(controlAddExpense);
  expenseView.addHandlerEdit(controlUpdateExpense);
  expenseView.addHandlerDelete(controlDeleteExpense);
  expenseView.addHandlerEditClick(controlEditExpenseClick);
  expenseView.addHandlerCalculate(controlCalculateShares);
  expenseView.addHandlerOpenForm(() => expenseView.openAddForm());
  expenseView.addHandlerFilter(controlExpenseFilter);

  // Payments
  paymentView.addHandlerRecordPayment(controlRecordPayment);
  paymentView.addHandlerOpenPaymentForm(controlOpenPaymentForm);
  paymentView.addHandlerDeletePayment(controlDeletePayment);
  paymentView.addHandlerFilter(controlPaymentFilter);

  // Initial render
  controlRenderDashboard();
}

// ── Boot ──
controlInit();

