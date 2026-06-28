import { CalendarRange } from 'lucide-react';

interface TimeRangeSelectorProps {
  options: string[];
  value: string;
  onChange: (option: string) => void;
}

// Labelled segmented control for the period. Strips the redundant "Last "
// prefix from displayed labels — full strings live in state for clarity. A
// quiet leading calendar glyph marks it as a time-range control.
export function TimeRangeSelector({ options, value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-0.5 border border-hairline rounded-input pl-2.5">
      <CalendarRange className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" aria-hidden="true" />
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`text-sm px-3 py-1.5 transition-colors duration-120 ${
              active ? 'bg-ink text-ink-inverse' : 'text-ink-secondary hover:text-ink'
            }`}
          >
            {opt.replace('Last ', '')}
          </button>
        );
      })}
    </div>
  );
}
