import { composeInsights } from '../application/insights.use-cases.js';
import type { RankedInsight } from '../domain/advisor.js';
import { allowedFigures, inventedFigures } from '../domain/figures.js';
import { detectAll } from '../domain/findings.js';
import { couple, EVAL_HOUSEHOLDS } from './fixtures.js';

/**
 * Offline evaluation of the advisor (runs in CI, no API calls). The "golden
 * rule" of ADR-0020 is checked against recorded model outputs: faithful ones
 * must pass untouched, hallucinated ones must never reach the user.
 * `npm run eval:advisor` runs the same checks against the live model.
 */

const findings = detectAll(couple);
const key = (kind: string) => findings.find((finding) => finding.kind === kind)!.key;
let next = 0;
const newId = () => `00000000-0000-4000-8000-${String((next += 1)).padStart(12, '0')}`;

/** What a well-behaved model answered for the couple household (recorded). */
const faithful: RankedInsight[] = [
  {
    key: key('expensive-debt'),
    priority: 1,
    title: 'Tu tarjeta te cuesta mucho',
    body: 'Al 21,9 % de interés, sumar 20,00 € al mes a la cuota es lo que más dinero te ahorra.',
  },
  {
    key: key('unusual-spending'),
    priority: 2,
    title: 'El ocio se disparó el mes pasado',
    body: 'Gastaste 310,00 €, 190,00 € más que tu media de 120,00 €. Un presupuesto te ayudará.',
  },
  {
    key: key('budget-exceeded'),
    priority: 3,
    title: 'Comida, por encima del límite',
    body: 'Llevas 435,00 € de 400,00 €: 35,00 € más de lo previsto este mes.',
  },
  {
    key: key('duplicate-subscription'),
    priority: 4,
    title: 'Dos Netflix a la vez',
    body: 'Quédate con «Netflix Premium» y ahorra 6,99 € al mes.',
  },
];

/** Recorded slips: rounding, computing a yearly figure, a made-up percentage. */
const hallucinated: RankedInsight[] = [
  { ...faithful[0]!, body: 'Pagando 20 € más ahorrarías unos 300 € en intereses.' },
  { ...faithful[1]!, body: 'Gastaste un 158 % más en ocio que de costumbre.' },
  { ...faithful[2]!, body: 'Vas camino de pasarte en 80 € a final de mes.' },
  { ...faithful[3]!, body: 'Cancelando el básico ahorrarías 83,88 € al año.' },
];

describe('advisor evaluation set', () => {
  it.each(Object.entries(EVAL_HOUSEHOLDS))(
    'the default texts of "%s" only contain figures from its data',
    (_name, household) => {
      const householdFindings = detectAll(household);
      const allowed = allowedFigures(householdFindings, household.currency);
      for (const finding of householdFindings) {
        expect(inventedFigures(`${finding.defaultTitle} ${finding.defaultBody}`, allowed)).toEqual(
          [],
        );
      }
    },
  );

  it('faithful model output is shown as written, in the model order', () => {
    const insights = composeInsights(findings, faithful, 'EUR', newId);

    expect(insights.map((insight) => insight.title)).toEqual(faithful.map((entry) => entry.title));
    expect(insights.map((insight) => insight.priority)).toEqual([1, 2, 3, 4]);
  });

  it('a response with any invented figure never reaches the user', () => {
    const insights = composeInsights(findings, hallucinated, 'EUR', newId);
    const allowed = allowedFigures(findings, 'EUR');

    for (const insight of insights) {
      expect(inventedFigures(`${insight.title} ${insight.body}`, allowed)).toEqual([]);
      // Each one fell back to the detector's own text.
      const finding = findings.find((candidate) => candidate.kind === insight.kind)!;
      expect(insight.body).toBe(finding.defaultBody);
    }
  });

  it('unknown keys and oversized texts are ignored; a later valid entry still counts', () => {
    const insights = composeInsights(
      findings,
      [
        { key: 'invented-key', priority: 1, title: 'Hola', body: 'Nada' },
        { ...faithful[3]!, priority: 1, title: 'x'.repeat(200) },
        faithful[3]!,
      ],
      'EUR',
      newId,
    );

    const duplicate = insights.find((insight) => insight.kind === 'duplicate-subscription')!;
    expect(duplicate.title).toBe('Dos Netflix a la vez');
    expect(insights).toHaveLength(findings.length);
    expect(insights.some((insight) => insight.title === 'Hola')).toBe(false);
  });

  it('without the model, insights keep the detectors order and texts', () => {
    const insights = composeInsights(findings, null, 'EUR', newId);

    expect(insights.map((insight) => insight.body)).toEqual(
      findings.map((finding) => finding.defaultBody),
    );
    expect(insights.map((insight) => insight.priority)).toEqual([1, 2, 3, 4]);
  });
});
