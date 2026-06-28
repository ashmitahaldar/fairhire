import { useState } from 'react';
import type { Role } from '@fairhire/shared';

interface RoleOption {
  value: Role;
  label: string;
  description: string;
}

const OPTIONS: RoleOption[] = [
  {
    value: 'manager',
    label: 'Hiring manager',
    description:
      'Upload debriefs, review flags on your own interviews, and record decisions. You see only your own patterns.',
  },
  {
    value: 'hr_admin',
    label: 'HR admin',
    description:
      'See organisation-level, anonymised metrics — flag rates, outcomes, demographics. Never an individual manager’s patterns.',
  },
];

interface RolePickerProps {
  onChoose: (role: Role) => void;
  submitting: boolean;
}

// First-run account-type chooser. Demo-only: in a real deployment HR access is
// granted by an org owner / invitation, not self-selected (role is a privilege
// boundary). Shown once, when no Manager row exists yet for this Clerk user.
export function RolePicker({ onChoose, submitting }: RolePickerProps) {
  const [selected, setSelected] = useState<Role | null>(null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="fh-card w-full max-w-lg p-8 shadow-float">
        <p className="fh-label mb-1">Welcome to FairHire</p>
        <h1 className="font-serif text-section text-ink mb-2">
          How will you use FairHire?
        </h1>
        <p className="text-sm text-ink-secondary mb-6">
          Choose your account type to finish setting up. This determines what you
          can see.
        </p>

        <fieldset className="space-y-3" disabled={submitting}>
          <legend className="sr-only">Account type</legend>
          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex gap-3 p-4 rounded-card border cursor-pointer transition-colors duration-120 ${
                  isSelected
                    ? 'border-accent bg-accent-soft'
                    : 'border-hairline hover:border-hairline-strong'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => setSelected(opt.value)}
                  className="mt-1 accent-accent"
                />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-ink">{opt.label}</span>
                  <span className="text-xs text-ink-secondary leading-relaxed">
                    {opt.description}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <button
          type="button"
          onClick={() => selected && onChoose(selected)}
          disabled={!selected || submitting}
          className="mt-6 w-full text-sm font-medium text-ink-inverse bg-ink px-4 py-2.5 rounded-input hover:bg-accent transition-colors duration-120 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Setting up…' : 'Continue'}
        </button>

        <p className="fh-meta mt-6 text-center">
          Demo · in production, HR access is granted by your organisation
        </p>
      </div>
    </div>
  );
}
