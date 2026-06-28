import { useRef, type CSSProperties, type KeyboardEvent } from 'react';

// Shared editorial tab bar — serif labels with an accent underline on the
// active tab. Extracted from the duplicate definitions in PatternMirrorScreen
// and HRDashboard so the two stay in lockstep and the ARIA tabs pattern lives
// in one place: role="tablist"/"tab", aria-selected, roving tabindex, and
// Left/Right/Home/End keyboard navigation. Pair each instance with a
// role="tabpanel" wrapper around the active body.
interface TabBarProps<T extends string> {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
}

export function TabBar<T extends string>({ tabs, active, onChange }: TabBarProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next]!);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" className="border-b border-hairline">
      <div className="flex items-end gap-8">
        {tabs.map((t, i) => {
          const isActive = active === t;
          return (
            <button
              key={t}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(t)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className="relative font-serif text-section py-4 transition-colors duration-120"
              style={
                {
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                } as CSSProperties
              }
            >
              {t}
              <span
                aria-hidden="true"
                className={`absolute left-0 right-0 -bottom-px h-px bg-accent transition-opacity duration-160 ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
