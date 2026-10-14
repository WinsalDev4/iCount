import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import type { AdvisorTool, Plan } from '../domain/advisor.js';
import { detectAll } from '../domain/findings.js';
import { couple } from '../eval/fixtures.js';
import { ADVISOR_MODEL, ClaudeAdvisorModel } from './claude-advisor-model.js';

type Params = Record<string, unknown> & { messages: unknown[] };

/** The SDK, simulated: `stream()` replays scripted turns, `parse()` a scripted answer. */
function fakeClient(
  turns: { text?: string; message: Record<string, unknown> }[],
  parsed?: unknown,
) {
  const streamCalls: Params[] = [];
  const parseCalls: Params[] = [];
  const parse = vi.fn(async (params: Params) => {
    parseCalls.push(params); // not cloned: the output format carries a parse function
    return parsed;
  });
  const client = {
    beta: {
      messages: {
        parse,
        stream: vi.fn((params: Params) => {
          streamCalls.push(structuredClone(params));
          const turn = turns.shift()!;
          const listeners: ((delta: string) => void)[] = [];
          return {
            on(event: string, listener: (delta: string) => void) {
              if (event === 'text') listeners.push(listener);
              return this;
            },
            async finalMessage() {
              if (turn.text) for (const listener of listeners) listener(turn.text);
              return { usage: { input_tokens: 1, output_tokens: 1 }, ...turn.message };
            },
          };
        }),
      },
    },
  };
  return { client: client as unknown as Anthropic, parse, streamCalls, parseCalls };
}

const plan: Plan = {
  id: '00000000-0000-4000-8000-000000000001',
  kind: 'debt-payoff',
  title: 'Pagar antes «Tarjeta»',
  summary: 'Resumen',
  steps: [{ title: 'Paso', detail: '', action: null }],
  projection: { monthlySavingMinor: null, interestSavedMinor: 100, debtFreeDate: null },
  currency: 'EUR',
};

const runSimulation = vi.fn(async ({ debt_ref }: { debt_ref: string }) => ({
  content: { debt: debt_ref, saved: '1,00 €' },
  plan,
}));

const simulate: AdvisorTool<{ debt_ref: string }> = {
  name: 'simulate',
  description: 'Simulates',
  inputSchema: {
    type: 'object',
    properties: { debt_ref: { type: 'string' } },
    required: ['debt_ref'],
    additionalProperties: false,
  },
  input: z.object({ debt_ref: z.string() }),
  run: runSimulation,
};

const request = {
  context: 'Today is 2026-10-14.',
  history: [
    { role: 'user' as const, content: '¿Cómo voy?' },
    { role: 'assistant' as const, content: 'Bien.' },
  ],
  message: '¿Y si pago más de la tarjeta?',
  tools: [simulate as AdvisorTool],
};

describe('ClaudeAdvisorModel', () => {
  it('is unavailable without an API key', () => {
    expect(new ClaudeAdvisorModel(null).available).toBe(false);
  });

  it('chat: streams text, runs validated tools and loops until the end of the turn', async () => {
    const { client, streamCalls } = fakeClient([
      {
        text: 'Lo calculo. ',
        message: {
          stop_reason: 'tool_use',
          content: [
            { type: 'thinking', thinking: '', signature: 'sig' },
            { type: 'tool_use', id: 'call-1', name: 'simulate', input: { debt_ref: 'D1' } },
            { type: 'tool_use', id: 'call-2', name: 'simulate', input: { wrong: true } },
          ],
        },
      },
      { text: 'Ahorrarías 1,00 €.', message: { stop_reason: 'end_turn', content: [] } },
    ]);
    const deltas: string[] = [];
    const plans: Plan[] = [];

    const result = await new ClaudeAdvisorModel(client).chat(
      request,
      { text: (delta) => deltas.push(delta), plan: (p) => plans.push(p) },
      new AbortController().signal,
    );

    expect(result).toEqual({ text: 'Lo calculo. Ahorrarías 1,00 €.', refused: false });
    expect(deltas).toEqual(['Lo calculo. ', 'Ahorrarías 1,00 €.']);
    expect(plans).toEqual([plan]);
    expect(runSimulation).toHaveBeenCalledTimes(1); // the invalid input never runs

    const [first, second] = streamCalls;
    expect(first).toMatchObject({
      model: ADVISOR_MODEL,
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
      output_config: { effort: 'low' },
      system: [{ type: 'text', cache_control: { type: 'ephemeral' } }],
      tools: [{ name: 'simulate', strict: true, eager_input_streaming: true }],
    });
    expect(first).not.toHaveProperty('thinking'); // adaptive by default on Opus 5.5
    expect(first?.messages).toHaveLength(3);
    // Append-only: the assistant turn goes back verbatim, then both tool results.
    expect(second?.messages.slice(0, 3)).toEqual(first?.messages);
    expect(second?.messages[3]).toMatchObject({ role: 'assistant' });
    expect(second?.messages[4]).toMatchObject({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'call-1' },
        { type: 'tool_result', tool_use_id: 'call-2', is_error: true },
      ],
    });
    // System prompt and tools are byte-identical across rounds (prompt cache, preserved thinking).
    expect(second?.system).toEqual(first?.system);
    expect(second?.tools).toEqual(first?.tools);
  });

  it('chat: a refusal ends the turn without running anything', async () => {
    const { client } = fakeClient([{ message: { stop_reason: 'refusal', content: [] } }]);

    const result = await new ClaudeAdvisorModel(client).chat(
      request,
      { text: () => undefined, plan: () => undefined },
      new AbortController().signal,
    );

    expect(result.refused).toBe(true);
  });

  it('rankInsights: structured output with medium effort, mapped back to the findings', async () => {
    const findings = detectAll(couple);
    const { client, parseCalls } = fakeClient([], {
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
      parsed_output: {
        insights: [
          { ref: 'F2', priority: 1, title: 'Título', body: 'Cuerpo' },
          { ref: 'F99', priority: 2, title: 'x', body: 'y' },
        ],
      },
    });

    const ranked = await new ClaudeAdvisorModel(client).rankInsights(findings, 'EUR');

    expect(ranked).toEqual([
      { key: findings[1]!.key, priority: 1, title: 'Título', body: 'Cuerpo' },
    ]);
    expect(parseCalls[0]).toMatchObject({
      model: ADVISOR_MODEL,
      fallbacks: 'default',
      output_config: { effort: 'medium', format: expect.anything() },
    });
    // Only aggregates and labels go out: no internal ids of budgets, debts or payments.
    const sent = JSON.stringify(parseCalls[0]?.messages);
    expect(sent).not.toMatch(/0199e0a4-0000-7000-8000-0000000[abd]/);
  });

  it('rankInsights: refusals and API errors degrade to null (default texts)', async () => {
    const findings = detectAll(couple);
    const refused = fakeClient([], { stop_reason: 'refusal', usage: {} });
    expect(await new ClaudeAdvisorModel(refused.client).rankInsights(findings, 'EUR')).toBeNull();

    const failing = fakeClient([]);
    failing.parse.mockRejectedValueOnce(new Error('overloaded'));
    expect(await new ClaudeAdvisorModel(failing.client).rankInsights(findings, 'EUR')).toBeNull();
  });
});
