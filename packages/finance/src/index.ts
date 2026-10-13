/**
 * Public API of @icount/finance: pure functions over integer cents, shared by
 * the app (offline simulations) and the API (source of truth). ADR-0015.
 * Amortisation and payoff strategies arrive in task A-4.1.
 */
export * from './rounding.ts';
