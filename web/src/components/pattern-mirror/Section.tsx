import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  caption?: string;
  anchor?: string;
  action?: ReactNode;
  children: ReactNode;
}

// Editorial section header — serif title, italic caption, optional right-hand
// action. The hairline rule separates header from chart/table body.
export function Section({ title, caption, anchor, action, children }: SectionProps) {
  return (
    <section id={anchor} className="mb-16">
      <div className="flex items-end justify-between gap-8 mb-6 pb-3 border-b border-hairline">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-section text-ink leading-tight">{title}</h2>
          {caption && (
            <p className="font-serif italic text-sm text-ink-tertiary mt-1">{caption}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}
