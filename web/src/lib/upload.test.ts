import { describe, expect, it } from 'vitest';
import { MAX_TRANSCRIPT_CHARS, readTranscriptFile, validateTranscript } from './upload';

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

describe('readTranscriptFile', () => {
  it('reads the text of a .txt file', async () => {
    const file = new File(['hello world'], 'debrief.txt', { type: 'text/plain' });
    await expect(readTranscriptFile(file)).resolves.toBe('hello world');
  });

  it('rejects a non-.txt file by extension', async () => {
    const file = new File(['data'], 'resume.pdf', { type: 'application/pdf' });
    await expect(readTranscriptFile(file)).rejects.toThrow(/\.txt/);
  });
});
