import { simulateExtraPayment } from '@icount/finance';

import { couple, tidyFlat } from '../eval/fixtures.js';
import { chatTools, describeHousehold } from './chat-tools.js';

let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String((counter += 1)).padStart(12, '0')}`;
const normalise = (value: unknown) => JSON.stringify(value).replace(/\\u00a0|\s/g, ' ');

function toolsFor(snapshot = couple) {
  const tools = chatTools(snapshot, newId);
  return (name: string) => tools.find((tool) => tool.name === name)!;
}

describe('advisor chat tools', () => {
  it('declares strict schemas (every property required, nothing extra)', () => {
    for (const tool of chatTools(couple, newId)) {
      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
      const { properties, required } = tool.inputSchema as {
        properties: Record<string, unknown>;
        required: string[];
      };
      expect(required.sort()).toEqual(Object.keys(properties).sort());
    }
  });

  it('reads month spending only for the months the snapshot has', async () => {
    const tool = toolsFor()('get_month_spending');
    const september = await tool.run({ month: '2026-09' });
    expect(normalise(september.content)).toContain('"total":"740,00 €"');

    const tooOld = await tool.run({ month: '2025-01' });
    expect(tooOld.content).toHaveProperty('error');
  });

  it('simulates an extra debt payment with @icount/finance and returns a plan card', async () => {
    const tool = toolsFor()('simulate_extra_debt_payment');
    const expected = simulateExtraPayment(
      {
        principalMinor: 250_000,
        annualRateBps: 2_190,
        paymentMinor: 12_000,
        firstPaymentDate: '2026-11-01',
      },
      5_000,
    );

    const result = await tool.run({ debt_ref: 'd1', extra_monthly_cents: 5_000 });

    expect(result.plan).toMatchObject({
      kind: 'debt-payoff',
      projection: {
        interestSavedMinor: expected.interestSavedMinor,
        debtFreeDate: expected.withExtra.payoffDate,
      },
      steps: [{ action: { type: 'extra-debt-payment', extraMonthlyMinor: 5_000 } }],
    });
    expect(result.content).toMatchObject({ monthsSaved: expected.monthsSaved });

    expect((await tool.run({ debt_ref: 'D9', extra_monthly_cents: 5_000 })).content).toHaveProperty(
      'error',
    );
  });

  it('proposes a savings plan from the detected opportunities, or says there is none', async () => {
    const plan = (await toolsFor()('propose_savings_plan').run({})).plan;
    // Duplicate Netflix (6,99 €) + unusual leisure (190 €).
    expect(plan?.projection.monthlySavingMinor).toBe(699 + 19_000);
    expect(plan?.steps.length).toBe(2);

    const none = await toolsFor(tidyFlat)('propose_savings_plan').run({});
    expect(none.plan).toBeUndefined();
  });

  it('describes the household with totals only', () => {
    const text = describeHousehold(couple);
    expect(text).toContain('Debts: 2');
    expect(text).not.toContain('Netflix');
  });
});
