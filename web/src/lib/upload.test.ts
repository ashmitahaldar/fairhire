import { describe, expect, it } from 'vitest';
import {
  MAX_TRANSCRIPT_CHARS,
  readTranscriptFile,
  validateTranscript,
  validatePromotionFields,
  type PromotionFields,
} from './upload';

describe('validateTranscript', () => {
  it('rejects empty / whitespace-only input', () => {
    expect(validateTranscript('   ')).toMatch(/Add a transcript/);
  });

  it('rejects input over the max length', () => {
    expect(validateTranscript('x'.repeat(MAX_TRANSCRIPT_CHARS + 1))).toMatch(/too long/);
  });

  it('accepts a normal transcript', () => {
    expect(validateTranscript('A genuine panel debrief transcript.')).toBeNull();
  });
});

describe('validatePromotionFields', () => {
  const ok: PromotionFields = { currentRole: 'Vice President', tenureYears: '6', lastPromotedAt: '' };

  it('accepts a fully-specified promotion fieldset', () => {
    expect(validatePromotionFields(ok)).toBeNull();
  });

  it('accepts tenure of zero years', () => {
    expect(validatePromotionFields({ ...ok, tenureYears: '0' })).toBeNull();
  });

  it('requires a current role', () => {
    expect(validatePromotionFields({ ...ok, currentRole: '  ' })).toMatch(/current role/i);
  });

  it('requires tenure to be present', () => {
    expect(validatePromotionFields({ ...ok, tenureYears: '' })).toMatch(/tenure/i);
  });

  it('rejects a non-numeric tenure', () => {
    expect(validatePromotionFields({ ...ok, tenureYears: 'six' })).toMatch(/tenure/i);
  });

  it('rejects a fractional tenure', () => {
    expect(validatePromotionFields({ ...ok, tenureYears: '6.5' })).toMatch(/whole number/i);
  });

  it('rejects tenure outside the 0–60 range', () => {
    expect(validatePromotionFields({ ...ok, tenureYears: '61' })).toMatch(/between 0 and 60/i);
    expect(validatePromotionFields({ ...ok, tenureYears: '-1' })).toMatch(/between 0 and 60/i);
  });
});

describe('readTranscriptFile', () => {
  it('reads the text of a .txt file', async () => {
    const file = new File(['hello world'], 'debrief.txt', { type: 'text/plain' });
    await expect(readTranscriptFile(file)).resolves.toBe('hello world');
  });

  it('rejects a non-.txt file by extension', async () => {
    const file = new File(['data'], 'resume.pdf', { type: 'application/pdf' });
    await expect(readTranscriptFile(file)).rejects.toThrow(/\.txt/);
  });

  it('rejects a .txt file whose decoded text exceeds the character cap', async () => {
    const file = new File(['x'.repeat(MAX_TRANSCRIPT_CHARS + 1)], 'long.txt', { type: 'text/plain' });
    await expect(readTranscriptFile(file)).rejects.toThrow(/too large/);
  });

  // Locks the bytes-vs-characters fix: a non-ASCII file under the character
  // cap but well over it in UTF-8 bytes (each CJK char is ~3 bytes) must
  // still be accepted, because the server measures string length.
  it('accepts a non-ASCII file under the character cap even if its byte size exceeds it', async () => {
    const text = '字'.repeat(MAX_TRANSCRIPT_CHARS - 1);
    const file = new File([text], 'jp.txt', { type: 'text/plain' });
    expect(file.size).toBeGreaterThan(MAX_TRANSCRIPT_CHARS);
    await expect(readTranscriptFile(file)).resolves.toHaveLength(text.length);
  });
});
