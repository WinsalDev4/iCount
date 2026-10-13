/**
 * Public API of @icount/finance: pure functions over integer cents, shared by
 * the app (offline simulations) and the API (source of truth). ADR-0015 and
 * docs/architecture/motor-financiero.md.
 */
export * from './amortization.ts';
export * from './dates.ts';
export * from './rounding.ts';
export * from './strategies.ts';
