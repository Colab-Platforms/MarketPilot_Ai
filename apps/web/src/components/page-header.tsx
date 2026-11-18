interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-title">{title}</h1>
        {description ? <p className="mt-1 max-w-[68ch] text-ink-secondary">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
