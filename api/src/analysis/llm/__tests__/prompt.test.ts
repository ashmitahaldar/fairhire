import {
  SYSTEM_PROMPT_HIRING,
  SYSTEM_PROMPT_PROMOTION,
  buildUserMessage,
  getSystemPrompt,
} from '../prompt';

// The system prompt is the LLM's whole contract — the vocabulary it
// emits, the schema it follows, the framing it uses. These tests are
// the cheap check that hiring and promotion prompts stay distinct and
// each one lists exactly the FlagTypes it should.

describe('getSystemPrompt', () => {
  it('returns the hiring prompt for hiring meetings', () => {
    const prompt = getSystemPrompt('hiring');
    expect(prompt).toBe(SYSTEM_PROMPT_HIRING);
    expect(prompt).toContain('asymmetric_concern');
    expect(prompt).toContain('hedging_language');
    expect(prompt).toContain('age_bias');
    expect(prompt).toContain('criteria_drift');
    expect(prompt).toContain('biased_language');
  });

  it('returns the promotion prompt for promotion meetings', () => {
    const prompt = getSystemPrompt('promotion');
    expect(prompt).toBe(SYSTEM_PROMPT_PROMOTION);
    expect(prompt).toContain('potential_vs_performance');
    expect(prompt).toContain('tenure_framing');
    expect(prompt).toContain('peer_comparison_bias');
    expect(prompt).toContain('confidence_proxy');
  });

  it('keeps hiring FlagTypes out of the promotion prompt', () => {
    const prompt = getSystemPrompt('promotion');
    expect(prompt).not.toContain('asymmetric_concern');
    expect(prompt).not.toContain('hedging_language');
    expect(prompt).not.toContain('criteria_drift');
  });

  it('keeps promotion FlagTypes out of the hiring prompt', () => {
    const prompt = getSystemPrompt('hiring');
    expect(prompt).not.toContain('potential_vs_performance');
    expect(prompt).not.toContain('tenure_framing');
    expect(prompt).not.toContain('confidence_proxy');
  });
});

describe('buildUserMessage', () => {
  it('frames hiring transcripts as interview transcripts', () => {
    const msg = buildUserMessage('Test transcript.', 'hiring');
    expect(msg).toContain('interview transcript');
    expect(msg).toContain('Test transcript.');
  });

  it('frames promotion transcripts as promotion-decisioning transcripts', () => {
    const msg = buildUserMessage('Test transcript.', 'promotion');
    expect(msg).toContain('promotion-decisioning transcript');
    expect(msg).toContain('Test transcript.');
  });

  it('defaults to hiring framing when no mode is passed (back-compat)', () => {
    const msg = buildUserMessage('Test transcript.');
    expect(msg).toContain('interview transcript');
  });
});
