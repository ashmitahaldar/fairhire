import { useState } from 'react';
import { Building2, Check, ShieldCheck, UserRound } from 'lucide-react';
import type { Role } from '@fairhire/shared';
import { useManager, useUpdateManager } from '../../lib/ManagerContext';
import { useDepartments, useUpdateDepartment } from '../../lib/useWorkspace';
import { ApiError } from '../../lib/api';

// Rendered inside Clerk's user-profile modal as a custom "Workspace" page (see
// Layout). Clerk owns identity (name, email, password); this owns the
// FairHire-specific workspace fields: account type (read-only — role is a
// privilege boundary) and division (editable within the org).

const ROLE_LABELS: Record<Role, string> = {
  manager: 'Hiring manager',
  hr_admin: 'HR admin',
};

const ROLE_BLURB: Record<Role, string> = {
  manager:
    'You review flags on your own interviews and record decisions. You only ever see your own patterns.',
  hr_admin:
    'You see organisation-level, anonymised metrics. Individual managers’ patterns are never identifiable.',
};

export function WorkspaceSettings() {
  const manager = useManager();
  const updateManager = useUpdateManager();
  const departments = useDepartments();
  const updateDept = useUpdateDepartment();

  const [selected, setSelected] = useState(manager.deptId);
  const dirty = selected !== manager.deptId;

  const save = () => {
    updateDept.mutate(selected, {
      // Reflect the change in the cached profile so `dirty` settles and the rest
      // of the session sees the new division without re-fetching /auth/me.
      onSuccess: (profile) => updateManager({ deptId: profile.deptId }),
    });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-section text-ink mb-1">Workspace</h1>
        <p className="text-sm text-ink-secondary">Your FairHire account type and division.</p>
      </header>

      {/* Account type — read-only */}
      <section>
        <div className="fh-label mb-2 flex items-center gap-1.5">
          {manager.role === 'hr_admin' ? (
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Account type
        </div>
        <div className="fh-card p-4">
          <div className="text-ink font-medium">{ROLE_LABELS[manager.role]}</div>
          <p className="text-sm text-ink-secondary mt-1 [text-wrap:pretty]">
            {ROLE_BLURB[manager.role]}
          </p>
          <p className="font-mono text-xs text-ink-tertiary mt-3">
            Set when your account was created. Contact an administrator to change it.
          </p>
        </div>
      </section>

      {/* Division — editable */}
      <section>
        <label htmlFor="division" className="fh-label mb-2 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          Division
        </label>

        {departments.isLoading && (
          <p className="font-mono text-sm text-ink-tertiary">Loading divisions…</p>
        )}
        {departments.isError && (
          <p className="font-mono text-sm text-ink-secondary">Couldn’t load divisions.</p>
        )}

        {departments.data && (
          <div className="flex flex-wrap items-center gap-3">
            <select
              id="division"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="bg-surface border border-hairline rounded-input px-3 py-2 text-sm text-ink outline-none focus:border-ink-secondary transition-colors duration-120"
            >
              {departments.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || updateDept.isPending}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-inverse bg-ink px-4 py-2 rounded-input hover:bg-accent transition-colors duration-120 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-ink"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {updateDept.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        {updateDept.isSuccess && !dirty && (
          <p className="font-mono text-xs text-ink-tertiary mt-2">Division updated.</p>
        )}
        {updateDept.isError && (
          <p className="font-mono text-sm text-accent mt-2" role="alert">
            {updateDept.error instanceof ApiError
              ? updateDept.error.userMessage
              : 'Couldn’t update your division. Try again.'}
          </p>
        )}
      </section>
    </div>
  );
}
