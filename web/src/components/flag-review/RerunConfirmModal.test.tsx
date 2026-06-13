import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RerunConfirmModal } from './RerunConfirmModal';

afterEach(cleanup);

const baseProps = {
  open: true,
  dismissedCount: 2,
  isPending: false,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('RerunConfirmModal', () => {
  it('renders nothing when open is false', () => {
    render(<RerunConfirmModal {...baseProps} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the gate when open is true and names the dismissal count', () => {
    render(<RerunConfirmModal {...baseProps} dismissedCount={3} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    // The "3 dismissals" callout sits in its own span; getByText
    // matches across the parent line.
    expect(screen.getByText(/3 dismissals/i)).toBeTruthy();
  });

  it('uses the singular noun when only one dismissal', () => {
    render(<RerunConfirmModal {...baseProps} dismissedCount={1} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/1 dismissal\b/i)).toBeTruthy();
    expect(screen.queryByText(/dismissals/i)).toBeNull();
  });

  it('fires onConfirm when the destructive button is clicked', () => {
    const onConfirm = vi.fn();
    render(<RerunConfirmModal {...baseProps} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /discard & re-run/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('fires onCancel from the Cancel button and from the backdrop', () => {
    const onCancel = vi.fn();
    render(<RerunConfirmModal {...baseProps} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Backdrop click — the dialog root has onClick={onCancel}; the
    // inner card stops propagation so only clicks outside the card
    // close it.
    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('does not close when the card itself is clicked', () => {
    const onCancel = vi.fn();
    render(<RerunConfirmModal {...baseProps} onConfirm={vi.fn()} onCancel={onCancel} />);
    // Click on the title element — child of the card, so propagation
    // should be stopped and onCancel should NOT fire.
    fireEvent.click(screen.getByRole('heading', { level: 2 }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('disables both buttons while the re-run is pending', () => {
    render(<RerunConfirmModal {...baseProps} isPending onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const cancel = screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement;
    const confirm = screen.getByRole('button', { name: /re-running/i }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    expect(confirm.disabled).toBe(true);
  });

  it('fires onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(<RerunConfirmModal {...baseProps} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
