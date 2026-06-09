import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AGE_BANDS,
  AGE_BAND_LABELS,
  GENDERS,
  GENDER_LABELS,
  NATIONALITY_STATUSES,
  NATIONALITY_STATUS_LABELS,
  RACES,
  RACE_LABELS,
  type AgeBand,
  type DemographicsInput,
  type Gender,
  type NationalityStatus,
  type Race,
} from '@fairhire/shared';
import {
  useCreateCandidateFull,
  useUpdateCandidate,
  type CandidateListItem,
} from '../../lib/candidatesApi';

// Add-or-edit candidate modal. One component for both modes — when
// `candidate` is null we POST, otherwise we PATCH that id. Form is a
// single scroll with three labelled sections (Identity / Demographics /
// Background) per Section 6 of the Week 4 plan. Name + role are required;
// every demographic field is optional and can be cleared on edit.

interface CandidateModalProps {
  open: boolean;
  candidate: CandidateListItem | null; // null → create mode
  onClose: () => void;
  onSaved?: (candidate: CandidateListItem) => void;
}

// Display labels come from the canonical shared maps — same vocabulary the
// CandidatesRow chip and any future HR surface render. Add row-specific
// abbreviations (e.g. RACE_SHORT) locally to the consumer instead of here.

interface FormState {
  name: string;
  roleAppliedFor: string;
  race: Race | '';
  gender: Gender | '';
  ageBand: AgeBand | '';
  nationalityStatus: NationalityStatus | '';
  firstLanguage: string;
  yearsInSingapore: string;
  university: string;
  major: string;
  previousEmployer: string;
  yearsExperience: string;
  currentBase: string;
}

function initialFormState(candidate: CandidateListItem | null): FormState {
  const d = candidate?.demographics ?? null;
  return {
    name: candidate?.name ?? '',
    roleAppliedFor: candidate?.roleAppliedFor ?? '',
    race: d?.race ?? '',
    gender: d?.gender ?? '',
    ageBand: d?.ageBand ?? '',
    nationalityStatus: d?.nationalityStatus ?? '',
    firstLanguage: d?.firstLanguage ?? '',
    yearsInSingapore:
      d?.yearsInSingapore !== null && d?.yearsInSingapore !== undefined
        ? String(d.yearsInSingapore)
        : '',
    university: d?.university ?? '',
    major: d?.major ?? '',
    previousEmployer: d?.previousEmployer ?? '',
    yearsExperience:
      d?.yearsExperience !== null && d?.yearsExperience !== undefined
        ? String(d.yearsExperience)
        : '',
    currentBase: d?.currentBase ?? '',
  };
}

// Empty strings collapse to null so the server clears the field instead of
// rejecting the blank as an invalid enum/length. Numbers parse to int or
// null when blank.
function buildDemographics(form: FormState): DemographicsInput {
  // Integer-only: round on the way out so a stray decimal entered into a
  // number input becomes a whole-year value rather than silently truncating.
  // The inputs also pin step={1} (see Field tags below) so most browsers
  // refuse the decimal at entry time; this is the belt-and-braces.
  const intOrNull = (v: string): number | null => {
    if (v === '') return null;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const strOrNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());
  const enumOrNull = <T extends string>(v: T | ''): T | null => (v === '' ? null : v);

  return {
    race: enumOrNull(form.race),
    gender: enumOrNull(form.gender),
    ageBand: enumOrNull(form.ageBand),
    nationalityStatus: enumOrNull(form.nationalityStatus),
    firstLanguage: strOrNull(form.firstLanguage),
    yearsInSingapore: intOrNull(form.yearsInSingapore),
    university: strOrNull(form.university),
    major: strOrNull(form.major),
    previousEmployer: strOrNull(form.previousEmployer),
    yearsExperience: intOrNull(form.yearsExperience),
    currentBase: strOrNull(form.currentBase),
  };
}

export function CandidateModal({ open, candidate, onClose, onSaved }: CandidateModalProps) {
  const isEdit = candidate !== null;
  const titleId = 'candidate-modal-title';
  const [form, setForm] = useState<FormState>(() => initialFormState(candidate));
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const create = useCreateCandidateFull();
  const update = useUpdateCandidate();
  const pending = create.isPending || update.isPending;

  // Reset form whenever the modal opens (or the target candidate changes).
  // Keeps stale state from leaking between successive opens.
  useEffect(() => {
    if (open) {
      setForm(initialFormState(candidate));
      setError(null);
      // Focus first field after the dialog renders. requestAnimationFrame
      // is enough — the input is already mounted by the time the effect
      // runs, focus just needs the next paint to take.
      requestAnimationFrame(() => firstFieldRef.current?.focus());
    }
  }, [open, candidate]);

  // Esc to close — wired here (not via native <dialog>) so backdrop
  // clicks and Esc share one close path.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Minimal focus trap: Tab from the last focusable child wraps to the
  // first, Shift+Tab from the first wraps to the last. Keeps focus inside
  // the modal so screen-reader users don't silently land on the page
  // underneath. Native <dialog> would handle this for free — the right
  // long-term move if/when a second modal lands.
  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    // Skip disabled controls — the browser refuses to focus them, so
    // including them in the wrap would land the user on a no-op element
    // (typically the Save button while a save is in flight).
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    const roleAppliedFor = form.roleAppliedFor.trim();
    if (!name || !roleAppliedFor) {
      setError('Name and role are required.');
      return;
    }
    const demographics = buildDemographics(form);

    try {
      let saved: CandidateListItem;
      if (isEdit && candidate) {
        saved = await update.mutateAsync({
          id: candidate.id,
          input: { name, roleAppliedFor, demographics },
        });
      } else {
        saved = await create.mutateAsync({ name, roleAppliedFor, demographics });
      }
      onSaved?.(saved);
      onClose();
    } catch {
      setError(
        isEdit
          ? 'Could not save changes. Please try again.'
          : 'Could not add candidate. Please try again.',
      );
    }
  };

  return (
    // Backdrop. Click outside the panel closes; clicks inside the panel
    // stopPropagation up to the dialog itself so they don't trigger the
    // backdrop's onClick.
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-12 transition-opacity duration-120"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
        className="w-full max-w-2xl bg-surface rounded-card shadow-float border border-hairline"
      >
        <div className="px-8 pt-8 pb-2 border-b border-hairline">
          <div className="font-serif italic text-base text-ink-tertiary mb-2">
            {isEdit ? 'Edit candidate' : 'Add candidate'}
          </div>
          <h2 id={titleId} className="font-serif text-section text-ink leading-tight">
            {isEdit ? candidate?.name : 'New candidate'}
          </h2>
        </div>

        <form onSubmit={onSubmit} className="px-8 py-6 space-y-8">
          <Section title="Identity">
            <Field label="Name" htmlFor="cand-name" required>
              <input
                id="cand-name"
                ref={firstFieldRef}
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
                className={inputCls}
              />
            </Field>
            <Field label="Role applied for" htmlFor="cand-role" required>
              <input
                id="cand-role"
                type="text"
                value={form.roleAppliedFor}
                onChange={(e) => set('roleAppliedFor', e.target.value)}
                required
                className={inputCls}
              />
            </Field>
          </Section>

          <Section title="Demographics">
            <Field label="Race" htmlFor="cand-race">
              <select
                id="cand-race"
                value={form.race}
                onChange={(e) => set('race', e.target.value as Race | '')}
                className={inputCls}
              >
                <option value="">—</option>
                {RACES.map((r) => (
                  <option key={r} value={r}>{RACE_LABELS[r]}</option>
                ))}
              </select>
            </Field>
            <Field label="Gender" htmlFor="cand-gender">
              <select
                id="cand-gender"
                value={form.gender}
                onChange={(e) => set('gender', e.target.value as Gender | '')}
                className={inputCls}
              >
                <option value="">—</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{GENDER_LABELS[g]}</option>
                ))}
              </select>
            </Field>
            <Field label="Age band" htmlFor="cand-age">
              <select
                id="cand-age"
                value={form.ageBand}
                onChange={(e) => set('ageBand', e.target.value as AgeBand | '')}
                className={inputCls}
              >
                <option value="">—</option>
                {AGE_BANDS.map((a) => (
                  <option key={a} value={a}>{AGE_BAND_LABELS[a]}</option>
                ))}
              </select>
            </Field>
            <Field label="Nationality status" htmlFor="cand-nationality">
              <select
                id="cand-nationality"
                value={form.nationalityStatus}
                onChange={(e) =>
                  set('nationalityStatus', e.target.value as NationalityStatus | '')
                }
                className={inputCls}
              >
                <option value="">—</option>
                {NATIONALITY_STATUSES.map((n) => (
                  <option key={n} value={n}>{NATIONALITY_STATUS_LABELS[n]}</option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="Background">
            <Field label="First language" htmlFor="cand-lang">
              <input
                id="cand-lang"
                type="text"
                value={form.firstLanguage}
                onChange={(e) => set('firstLanguage', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Years in Singapore" htmlFor="cand-yis">
              <input
                id="cand-yis"
                type="number"
                min={0}
                step={1}
                value={form.yearsInSingapore}
                onChange={(e) => set('yearsInSingapore', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="University" htmlFor="cand-uni">
              <input
                id="cand-uni"
                type="text"
                value={form.university}
                onChange={(e) => set('university', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Major" htmlFor="cand-major">
              <input
                id="cand-major"
                type="text"
                value={form.major}
                onChange={(e) => set('major', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Previous employer" htmlFor="cand-prev">
              <input
                id="cand-prev"
                type="text"
                value={form.previousEmployer}
                onChange={(e) => set('previousEmployer', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Years experience" htmlFor="cand-yexp">
              <input
                id="cand-yexp"
                type="number"
                min={0}
                step={1}
                value={form.yearsExperience}
                onChange={(e) => set('yearsExperience', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Current base" htmlFor="cand-base">
              <input
                id="cand-base"
                type="text"
                value={form.currentBase}
                onChange={(e) => set('currentBase', e.target.value)}
                className={inputCls}
              />
            </Field>
          </Section>

          {error && <p className="text-sm text-accent">{error}</p>}

          <div className="flex items-center justify-end gap-4 pt-2 border-t border-hairline">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-ink-secondary hover:text-ink transition-colors duration-120"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="text-sm font-medium text-ink-inverse bg-ink px-4 py-2 rounded-input hover:bg-accent transition-colors duration-120 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-surface border border-hairline rounded-input px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary outline-none focus:border-ink-secondary transition-colors duration-120';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="fh-label mb-1">{title}</legend>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs text-ink-secondary mb-1">
        {label}
        {required && <span className="text-accent ml-1" aria-hidden="true">*</span>}
      </label>
      {children}
    </div>
  );
}
