import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NudgeCard } from './NudgeCard';
import type { MirrorNudge } from '../../lib/mirrorData';

// NudgeCard is shared by the Pattern Mirror and the HR Overview. The "See in …"
// button is the integration point both screens use to switch tabs, so it's
// covered here directly.

afterEach(cleanup);

const baseNudge: MirrorNudge = {
  id: 'n1',
  tag: 'Organisation · representation',
  sentence: 'Hires this period were 90% majority background vs an applied pool of 70%.',
  linkTo: 'Demographics',
};

describe('NudgeCard', () => {
  it('renders the tag and sentence', () => {
    render(<NudgeCard nudge={baseNudge} />);
    expect(screen.getByText(baseNudge.tag)).toBeTruthy();
    expect(screen.getByText(baseNudge.sentence)).toBeTruthy();
  });

  it('renders a "See in <tab>" button and passes the nudge to onSeeInstances', () => {
    const onSeeInstances = vi.fn();
    render(<NudgeCard nudge={baseNudge} onSeeInstances={onSeeInstances} />);

    const button = screen.getByRole('button', { name: /See in Demographics/i });
    fireEvent.click(button);

    expect(onSeeInstances).toHaveBeenCalledTimes(1);
    expect(onSeeInstances).toHaveBeenCalledWith(baseNudge);
  });

  it('renders no CTA when the nudge has no linkTo', () => {
    const noLink: MirrorNudge = { id: 'n2', tag: baseNudge.tag, sentence: baseNudge.sentence };
    render(<NudgeCard nudge={noLink} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
