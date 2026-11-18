'use client';

import { useState } from 'react';
import {
  questionsFor,
  questionStepSchema,
  type OnboardingState,
  type QuestionDef,
  type QuestionStep as QuestionStepName,
} from '@marketpilot/contracts';
import { QuestionField, type AnswerValue } from './question-field';
import { StepFrame } from './step-frame';
import { useStepSubmit } from './use-step-submit';

const COPY: Record<QuestionStepName, { business: [string, string]; creator: [string, string] }> = {
  about: {
    business: ['What does your business do?', 'This helps us write posts that sound like you. You can change anything later.'],
    creator: ['Tell us about your content', 'This helps us write posts that sound like you. You can change anything later.'],
  },
  goals: {
    business: ['What do you want from marketing?', 'We will shape your plan around this.'],
    creator: ['What do you want from your content?', 'We will shape your plan around this.'],
  },
};

function initialValue(question: QuestionDef, saved: unknown, known: string | undefined): AnswerValue {
  if ((saved === undefined || saved === null) && question.store === 'column' && known) {
    if (question.kind === 'text' || question.kind === 'textarea' || question.kind === 'select') return known;
  }
  if (question.kind === 'multiselect') return Array.isArray(saved) ? (saved as string[]) : [];
  if (question.kind === 'tags') return Array.isArray(saved) ? saved.join(', ') : '';
  return saved === undefined || saved === null ? '' : String(saved);
}

// Turns the form's strings into the typed answers the API schema expects.
function toAnswers(questions: QuestionDef[], values: Record<string, AnswerValue>) {
  const answers: Record<string, unknown> = {};
  const clientErrors: Record<string, string> = {};
  for (const question of questions) {
    const value = values[question.id] ?? '';
    if (question.kind === 'multiselect') {
      answers[question.id] = value;
    } else if (question.kind === 'tags') {
      const tags = String(value).split(',').map((tag) => tag.trim()).filter(Boolean);
      if (tags.length > 0) answers[question.id] = tags;
    } else if (question.kind === 'money') {
      const text = String(value).trim().replace(/,/g, '');
      if (text === '') continue;
      if (!/^\d+$/.test(text)) clientErrors[question.id] = 'Enter a whole number, like 5000';
      else answers[question.id] = Number(text);
    } else if (value !== '' || question.required) {
      answers[question.id] = value;
    }
  }
  return { answers, clientErrors };
}

export function QuestionStep({ step, state }: { step: QuestionStepName; state: OnboardingState }) {
  const questions = questionsFor(step, state.track);
  const saved = (state.answers[step] ?? {}) as Record<string, unknown>;
  const { submit, saving, fieldErrors, setFieldErrors, formError } = useStepSubmit(step);
  const [values, setValues] = useState<Record<string, AnswerValue>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, initialValue(q, saved[q.id], state.known[q.field])])),
  );
  const [title, description] = COPY[step][state.track];

  function onSubmit() {
    const { answers, clientErrors } = toAnswers(questions, values);
    const parsed = questionStepSchema(step, state.track).safeParse(answers);
    const errors = { ...clientErrors };
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) submit(answers);
  }

  return (
    <StepFrame
      step={step}
      title={title}
      description={description}
      error={formError}
      saving={saving}
      submitLabel={step === 'goals' ? 'Finish' : 'Continue'}
      onSubmit={onSubmit}
    >
      {questions.map((question) => (
        <QuestionField
          key={question.id}
          question={question}
          value={values[question.id] ?? ''}
          error={fieldErrors[question.id]}
          onChange={(next) => {
            setValues((current) => ({ ...current, [question.id]: next }));
            setFieldErrors(({ [question.id]: _cleared, ...rest }) => rest);
          }}
        />
      ))}
    </StepFrame>
  );
}
