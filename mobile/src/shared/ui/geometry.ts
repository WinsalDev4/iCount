/** Pure helpers for the SVG charts (ProgressRing, Donut). No React here: easy to unit-test. */

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export type DonutSlice = { value: number; color: string };

export type DonutArc = {
  color: string;
  /** Visible stroke length, in the same units as the circumference. */
  length: number;
  /** Where the arc starts along the circumference. */
  offset: number;
};

/**
 * Turns slice values into arcs of a circle with the given circumference.
 * Negative or non-finite values count as 0; with total 0 there are no arcs.
 * `gap` (in circumference units) separates neighbouring slices.
 */
export function donutArcs(
  slices: readonly DonutSlice[],
  circumference: number,
  gap = 0,
): DonutArc[] {
  const safe = slices.map((slice) => ({
    ...slice,
    value: Number.isFinite(slice.value) && slice.value > 0 ? slice.value : 0,
  }));
  const total = safe.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return [];

  const visible = safe.filter((slice) => slice.value > 0);
  let cursor = 0;
  const arcs: DonutArc[] = [];
  for (const slice of visible) {
    const span = (slice.value / total) * circumference;
    const length = Math.max(0, span - (visible.length > 1 ? gap : 0));
    arcs.push({ color: slice.color, length, offset: cursor });
    cursor += span;
  }
  return arcs;
}
