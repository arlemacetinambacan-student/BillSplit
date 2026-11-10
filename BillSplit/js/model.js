/**
 * MODEL — model.js
 * Responsible for application state, data persistence (localStorage),
 * CRUD operations, and all business-logic calculations.
 *
 * This file must NEVER access the DOM or import any View.
 */

// ─── Constants ───────────────────────────────────────────────────────
const STORAGE_KEY = 'billsplit_data';

// ─── Application State ──────────────────────────────────────────────
export const state = {
  expenses: [],
  payments: [],
  settings: {
    currency: 'PHP',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Generate a unique ID with a given prefix.
 * @param {string} prefix  e.g. "exp", "part", "pay"
 * @returns {string}
 */
const generateId = prefix =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

/**
 * Format a number as Philippine Peso currency string.
 * @param {number} amount
 * @returns {string}  e.g. "₱1,200.00"
 */
export const formatCurrency = amount => {
  const num = Number(amount) || 0;
  return `₱${num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// ─── LocalStorage Persistence ────────────────────────────────────────

/** Load previously saved data from localStorage into state. */
export const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return; // first launch — keep empty state
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.expenses)) state.expenses = parsed.expenses;
      if (Array.isArray(parsed.payments)) state.payments = parsed.payments;
      if (parsed.settings)
        state.settings = { ...state.settings, ...parsed.settings };
    }
  } catch (err) {
    console.error('BillSplit: failed to load data —', err);
    // Keep default empty state; don't crash.
  }
};

/** Save the current state to localStorage. */
export const saveData = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('BillSplit: failed to save data —', err);
  }
};

// ─── Expense CRUD ────────────────────────────────────────────────────

/**
 * Add a new shared expense.
 * @param {Object} data  { name, category, amount, date, description, splitType, participants:[{name,share}] }
 * @returns {Object} the newly created expense object
 */
export const addExpense = data => {
  const expense = {
    id: generateId('exp'),
    name: data.name.trim(),
    category: data.category || 'General',
    amount: Number(data.amount),
    date: data.date || new Date().toISOString().split('T')[0],
    description: (data.description || '').trim(),
    splitType: data.splitType || 'equal',
    participants: data.participants.map(p => ({
      id: generateId('part'),
      name: p.name.trim(),
      share: Number(p.share),
    })),
  };
  state.expenses.push(expense);
  saveData();
  return expense;
};

/**
 * Update an existing expense.
 * Also removes orphaned payments for participants that no longer exist
 * and caps payments that exceed a reduced share.
 * @param {string} id     Expense ID
 * @param {Object} data   Updated fields (same shape as addExpense data)
 * @returns {Object|null}
 */
export const updateExpense = (id, data) => {
  const idx = state.expenses.findIndex(e => e.id === id);
  if (idx === -1) return null;

  const old = state.expenses[idx];

  // Build updated participant list, preserving IDs where names match
  const updatedParticipants = data.participants.map(p => {
    // Try to find an existing participant with the same ID (for edits)
    const existing = p.id ? old.participants.find(op => op.id === p.id) : null;
    return {
      id: existing ? existing.id : generateId('part'),
      name: p.name.trim(),
      share: Number(p.share),
    };
  });

  const updatedExpense = {
    ...old,
    name: data.name.trim(),
    category: data.category || old.category,
    amount: Number(data.amount),
    date: data.date || old.date,
    description:
      data.description !== undefined
        ? (data.description || '').trim()
        : old.description,
    splitType: data.splitType || old.splitType,
    participants: updatedParticipants,
  };

  // Remove payments for participants that no longer exist
  const validPartIds = new Set(updatedParticipants.map(p => p.id));
  state.payments = state.payments.filter(
    pay => pay.expenseId !== id || validPartIds.has(pay.participantId)
  );

  // Cap payments: if total payments exceed the new share, remove excess payments
  updatedParticipants.forEach(part => {
    const partPayments = state.payments.filter(
      pay => pay.expenseId === id && pay.participantId === part.id
    );
    let total = 0;
    partPayments.forEach(pay => {
      total += pay.amount;
      if (total > part.share) {
        // Remove this payment entirely (simplest safe approach)
        state.payments = state.payments.filter(p => p.id !== pay.id);
        total -= pay.amount;
      }
    });
  });

  state.expenses[idx] = updatedExpense;
  saveData();
  return updatedExpense;
};

/**
 * Delete an expense and all its associated payments.
 * @param {string} id  Expense ID
 */
export const deleteExpense = id => {
  state.expenses = state.expenses.filter(e => e.id !== id);
  state.payments = state.payments.filter(p => p.expenseId !== id);
  saveData();
};

// ─── Participant helpers ─────────────────────────────────────────────

/**
 * Add a participant to an existing expense (optional helper).
 */
export const addParticipant = (expenseId, data) => {
  const expense = state.expenses.find(e => e.id === expenseId);
  if (!expense) return null;
  const participant = {
    id: generateId('part'),
    name: data.name.trim(),
    share: Number(data.share),
  };
  expense.participants.push(participant);
  saveData();
  return participant;
};

/**
 * Update a participant's name or share within an expense.
 */
export const updateParticipant = (expenseId, participantId, data) => {
  const expense = state.expenses.find(e => e.id === expenseId);
  if (!expense) return null;
  const part = expense.participants.find(p => p.id === participantId);
  if (!part) return null;
  if (data.name !== undefined) part.name = data.name.trim();
  if (data.share !== undefined) part.share = Number(data.share);
  saveData();
  return part;
};

// ─── Payment CRUD ────────────────────────────────────────────────────

/**
 * Record a payment from a participant.
 * @param {Object} data  { expenseId, participantId, amount, date }
 * @returns {Object} the created payment, or null on error
 */
export const addPayment = data => {
  const payment = {
    id: generateId('pay'),
    expenseId: data.expenseId,
    participantId: data.participantId,
    amount: Number(data.amount),
    date: data.date || new Date().toISOString().split('T')[0],
  };
  state.payments.push(payment);
  saveData();
  return payment;
};

/**
 * Update an existing payment record.
 */
export const updatePayment = (id, data) => {
  const idx = state.payments.findIndex(p => p.id === id);
  if (idx === -1) return null;
  if (data.amount !== undefined)
    state.payments[idx].amount = Number(data.amount);
  if (data.date !== undefined) state.payments[idx].date = data.date;
  saveData();
  return state.payments[idx];
};

/**
 * Delete a payment record.
 */
export const deletePayment = id => {
  state.payments = state.payments.filter(p => p.id !== id);
  saveData();
};

// ─── Calculations ────────────────────────────────────────────────────

/**
 * Get total payments made by a specific participant on a specific expense.
 */
export const getParticipantPayments = (expenseId, participantId) =>
  state.payments
    .filter(p => p.expenseId === expenseId && p.participantId === participantId)
    .reduce((sum, p) => sum + p.amount, 0);

/**
 * Get full balance info for one participant on one expense.
 * @returns {{ expenseId, expenseName, participantId, participantName,
 *             share, totalPaid, remaining, status, payments }}
 */
export const getParticipantBalance = (expenseId, participantId) => {
  const expense = state.expenses.find(e => e.id === expenseId);
  if (!expense) return null;
  const participant = expense.participants.find(p => p.id === participantId);
  if (!participant) return null;

  const totalPaid = getParticipantPayments(expenseId, participantId);
  const remaining = Math.max(0, participant.share - totalPaid);

  let status = 'Unpaid';
  if (totalPaid > 0 && totalPaid < participant.share) status = 'Partially Paid';
  if (totalPaid >= participant.share) status = 'Fully Paid';

  // Attach individual payment records
  const paymentRecords = state.payments.filter(
    p => p.expenseId === expenseId && p.participantId === participantId
  );

  return {
    expenseId,
    expenseName: expense.name,
    expenseCategory: expense.category,
    expenseDate: expense.date,
    participantId,
    participantName: participant.name,
    share: participant.share,
    totalPaid,
    remaining,
    status,
    payments: paymentRecords,
  };
};

/**
 * Get balance info for every participant across all expenses.
 * @returns {Array}
 */
export const getAllParticipantBalances = () => {
  const balances = [];
  state.expenses.forEach(expense => {
    expense.participants.forEach(participant => {
      const balance = getParticipantBalance(expense.id, participant.id);
      if (balance) balances.push(balance);
    });
  });
  return balances;
};

/**
 * Dashboard summary numbers.
 */
export const getExpenseSummary = () => {
  const totalExpenses = state.expenses.reduce((s, e) => s + e.amount, 0);
  const balances = getAllParticipantBalances();
  const totalCollected = balances.reduce((s, b) => s + b.totalPaid, 0);
  const totalToCollect = balances.reduce((s, b) => s + b.remaining, 0);
  const pendingPayments = balances.filter(b => b.status !== 'Fully Paid').length;

  return {
    totalExpenses,
    totalCollected,
    totalToCollect,
    pendingPayments,
    expenseCount: state.expenses.length,
  };
};

/**
 * Get only outstanding (non-fully-paid) participant balances.
 */
export const getOutstandingBalance = () =>
  getAllParticipantBalances().filter(b => b.remaining > 0);

/**
 * Calculate the per-person share for an equal split.
 * @param {number} totalAmount
 * @param {number} participantCount
 * @returns {number}
 */
export const calculateEqualSplit = (totalAmount, participantCount) => {
  if (!participantCount || participantCount <= 0) return 0;
  return Math.round((totalAmount / participantCount) * 100) / 100;
};

/**
 * Equal shares in cents so the parts add back to the original total.
 * Earlier people receive the leftover cent first.
 * @param {number} totalAmount
 * @param {number} participantCount
 * @returns {number[]}
 */
export const calculateEqualShares = (totalAmount, participantCount) => {
  const count = Number(participantCount) || 0;
  if (count <= 0) return [];
  const totalCents = Math.round((Number(totalAmount) || 0) * 100);
  const base = Math.floor(totalCents / count);
  let leftover = totalCents - base * count;
  return Array.from({ length: count }, () => {
    const cents = base + (leftover > 0 ? 1 : 0);
    if (leftover > 0) leftover -= 1;
    return cents / 100;
  });
};

/**
 * Get recent expenses (most recent first), limited to `count`.
 */
export const getRecentExpenses = (count = 5) =>
  [...state.expenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, count);

// ─── Sample Data ─────────────────────────────────────────────────────

/**
 * Load a small set of clearly labeled sample records.
 * Called only when the user explicitly requests it.
 */
export const loadSampleData = () => {
  // Clear current data
  state.expenses = [];
  state.payments = [];

  const exp1 = addExpense({
    name: 'Restaurant Dinner',
    category: 'Food',
    amount: 1200,
    date: '2026-11-09',
    description: 'Team dinner at Jollibee after class',
    splitType: 'equal',
    participants: [
      { name: 'Arlem', share: 300 },
      { name: 'Christian', share: 300 },
      { name: 'Von', share: 300 },
      { name: 'Janslee', share: 300 },
    ],
  });

  const exp2 = addExpense({
    name: 'Grab Ride to Campus',
    category: 'Transportation',
    amount: 500,
    date: '2026-11-08',
    description: 'Shared Grab ride from dorm to school',
    splitType: 'equal',
    participants: [
      { name: 'Arlem', share: 250 },
      { name: 'Von', share: 250 },
    ],
  });

  const exp3 = addExpense({
    name: 'Project Supplies',
    category: 'Shopping',
    amount: 750,
    date: '2026-11-07',
    description: 'Cartolina, markers, and folders for IT project',
    splitType: 'custom',
    participants: [
      { name: 'Arlem', share: 250 },
      { name: 'Von', share: 250 },
      { name: 'Janslee', share: 250 },
    ],
  });

  // Add some sample payments
  addPayment({
    expenseId: exp1.id,
    participantId: exp1.participants[0].id, // Arlem — partial
    amount: 150,
    date: '2026-11-09',
  });
  addPayment({
    expenseId: exp1.id,
    participantId: exp1.participants[1].id, // Christian — full
    amount: 300,
    date: '2026-11-09',
  });
  addPayment({
    expenseId: exp2.id,
    participantId: exp2.participants[1].id, // Von — full
    amount: 250,
    date: '2026-11-08',
  });

  saveData();
};

