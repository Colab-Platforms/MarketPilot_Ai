import type { QuestionDef } from '@marketpilot/contracts';
import { ChoiceCard, Field, FieldGroup, Input, Select, Textarea } from '@marketpilot/ui';

// Setup sizing: larger text and stronger borders, as in the approved design.
const controlClass = 'rounded-lg border-line-strong text-lead';

export type AnswerValue = string | string[];

interface QuestionFieldProps {
  question: QuestionDef;
  value: AnswerValue;
  error?: string;
  onChange: (value: AnswerValue) => void;
}

export function QuestionField({ question, value, error, onChange }: QuestionFieldProps) {
  const text = typeof value === 'string' ? value : '';
  const common = { label: question.label, helper: question.helper, error, optional: !question.required };

  switch (question.kind) {
    case 'text':
    case 'tags':
    case 'money':
      return (
        <Field {...common}>
          <Input
            className={`h-control-lg pl-4 ${controlClass}`}
            value={text}
            maxLength={question.maxLength}
            inputMode={question.kind === 'money' ? 'numeric' : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
      );
    case 'textarea':
      return (
        <Field {...common}>
          <Textarea
            className={`px-4 py-3 ${controlClass}`}
            value={text}
            maxLength={question.maxLength}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
      );
    case 'select':
      return (
        <Field {...common}>
          <Select className={`h-control-lg pl-4 ${controlClass}`} value={text} onChange={(event) => onChange(event.target.value)}>
            <option value="">Choose one</option>
            {question.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      );
    case 'multiselect': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <FieldGroup legend={question.label} helper={question.helper} error={error}>
          <div className="grid gap-3 md:grid-cols-3">
            {question.options?.map((option) => (
              <ChoiceCard
                key={option.value}
                type="checkbox"
                name={question.id}
                value={option.value}
                title={option.label}
                checked={selected.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value),
                  )
                }
              />
            ))}
          </div>
        </FieldGroup>
      );
    }
  }
}
