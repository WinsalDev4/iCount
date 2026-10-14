import Anthropic from '@anthropic-ai/sdk';

import { composeInsights } from '../application/insights.use-cases.js';
import { allowedFigures, inventedFigures } from '../domain/figures.js';
import { detectAll } from '../domain/findings.js';
import { ClaudeAdvisorModel } from '../infrastructure/claude-advisor-model.js';
import { EVAL_HOUSEHOLDS } from './fixtures.js';

/**
 * Live evaluation (`npm run eval:advisor`): sends the fictional households'
 * findings to the real model and checks that it does not invent figures.
 * Reports how many raw answers the guard had to discard; the shown texts must
 * be clean either way. Needs ANTHROPIC_API_KEY; skipped without it.
 */
const apiKey = process.env.ANTHROPIC_API_KEY;

describe.skipIf(!apiKey)('advisor live evaluation', () => {
  const model = new ClaudeAdvisorModel(apiKey ? new Anthropic({ apiKey }) : null);

  it.each(Object.entries(EVAL_HOUSEHOLDS).filter(([, h]) => detectAll(h).length > 0))(
    '%s: ranked, worded and without invented figures',
    async (name, household) => {
      const findings = detectAll(household);
      const ranked = await model.rankInsights(findings, household.currency);
      expect(ranked, 'the model answered with a valid structured output').not.toBeNull();

      const allowed = allowedFigures(findings, household.currency);
      const raw = ranked!.map((entry) => ({
        key: entry.key,
        invented: inventedFigures(`${entry.title} ${entry.body}`, allowed),
      }));
      const discarded = raw.filter((entry) => entry.invented.length > 0);
      console.info(
        `[${name}] ${ranked!.length} insights, ${discarded.length} discarded by the guard`,
        discarded,
      );

      const shown = composeInsights(findings, ranked, household.currency, () =>
        crypto.randomUUID(),
      );
      for (const insight of shown) {
        expect(inventedFigures(`${insight.title} ${insight.body}`, allowed)).toEqual([]);
      }
      expect(new Set(ranked!.map((entry) => entry.key))).toEqual(
        new Set(findings.map((finding) => finding.key)),
      );
    },
  );
});
