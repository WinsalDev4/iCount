/** Pure pager arithmetic, so the ViewModel and the tests need no React. */

/** Keeps an index inside [0, total - 1]; non-integers are rounded, NaN becomes 0. */
export function clampStep(index: number, total: number): number {
  if (total <= 0 || !Number.isFinite(index)) return 0;
  return Math.min(total - 1, Math.max(0, Math.round(index)));
}

export function isLastStep(index: number, total: number): boolean {
  return total > 0 && index >= total - 1;
}

/** Index of the page that a horizontal scroll offset is showing. */
export function stepFromOffset(offsetX: number, pageWidth: number, total: number): number {
  if (pageWidth <= 0) return 0;
  return clampStep(offsetX / pageWidth, total);
}
