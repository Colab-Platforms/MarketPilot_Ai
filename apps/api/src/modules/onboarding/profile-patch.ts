import { questionsFor, type AccountType, type QuestionAnswers, type QuestionStep } from '@marketpilot/contracts';
import type { ProfilePatch } from '@/modules/brand';

// Turns validated questionnaire answers into profile writes. Optional answers the
// owner left blank are skipped so they never overwrite earlier values.
export function buildProfilePatch(
  step: QuestionStep,
  track: AccountType,
  answers: QuestionAnswers,
): ProfilePatch {
  const patch: ProfilePatch = { columns: {}, attributes: {} };

  for (const question of questionsFor(step, track)) {
    const value = answers[question.id];
    if (value === undefined || value === '') continue;

    const stored = question.kind === 'money' ? Number(value) * 100 : value;
    if (question.store === 'attribute') {
      patch.attributes[question.field] = stored;
    } else {
      patch.columns[question.field] = stored;
    }
  }

  if (typeof patch.columns.category === 'string') patch.columns.categoryPack = patch.columns.category;
  return patch;
}
