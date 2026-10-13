/**
 * Built-in expense/income categories, shared by several features (transactions,
 * household split rules, budgets). Mirrors `categoryIdSchema` in @icount/contracts.
 */
export type CategoryId =
  | 'food'
  | 'bills'
  | 'housing'
  | 'transport'
  | 'loans'
  | 'insurance'
  | 'leisure'
  | 'salary'
  | 'other';
