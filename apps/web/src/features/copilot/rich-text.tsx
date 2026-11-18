import { Fragment, type ReactNode } from 'react';

// The small subset of Markdown the copilot writes: paragraphs, bullet and numbered lists, and
// **bold**. Built as React elements, never as HTML, so model output cannot inject markup.

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((line) => line.trim());
        if (lines.length > 0 && lines.every((line) => BULLET.test(line))) {
          const ordered = /^\s*\d/.test(lines[0] ?? '');
          const List = ordered ? 'ol' : 'ul';
          return (
            <List key={i} className={ordered ? 'list-decimal pl-5' : 'list-disc pl-5'}>
              {lines.map((line, j) => (
                <li key={j}>{inline(line.replace(BULLET, ''))}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(block.replace(/^#+\s*/gm, ''))}
          </p>
        );
      })}
    </div>
  );
}
