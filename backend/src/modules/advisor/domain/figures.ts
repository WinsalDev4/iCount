import { formatMoney } from '../../../shared/application/format-money.js';
import type { Finding } from './findings.js';

/**
 * The golden rule of ADR-0020: the model never invents numbers. Every figure in
 * a generated text must be one we gave it; otherwise the text is discarded and
 * the detector's default wording is used.
 *
 * Figures are compared as numbers, so "1.234,50 €", "1234,5" and "1 234,50"
 * are the same figure, while "1.235" (a rounded amount) is a different one.
 */

// 1.234,56 · 1 234,56 · 1234,56 · 12 · 6,9 (thousands with "." or a space).
const FIGURE = /\d{1,3}(?:[.\s  ]\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;

function canonical(figure: string): string {
  const plain = figure.replace(/[.\s  ]/g, '').replace(',', '.');
  return String(Number(plain));
}

/** Every figure written in a text, normalised. */
export function figuresIn(text: string): string[] {
  return [...text.matchAll(FIGURE)].map((match) => canonical(match[0]));
}

/** The figures the model is allowed to write for these findings. */
export function allowedFigures(findings: readonly Finding[], currency: string): Set<string> {
  const texts = findings.flatMap((finding) => [
    ...finding.evidence.map((evidence) => formatMoney(evidence.amountMinor, currency)),
    ...(finding.potentialMonthlySavingsMinor === null
      ? []
      : [formatMoney(finding.potentialMonthlySavingsMinor, currency)]),
    ...finding.facts,
    // Names may carry numbers ("Netflix 4K"): they are data too.
    finding.defaultTitle,
    finding.defaultBody,
  ]);
  return new Set(texts.flatMap(figuresIn));
}

/** Figures in `text` that are not in `allowed` (empty = the text is safe to show). */
export function inventedFigures(text: string, allowed: ReadonlySet<string>): string[] {
  return figuresIn(text).filter((figure) => !allowed.has(figure));
}
