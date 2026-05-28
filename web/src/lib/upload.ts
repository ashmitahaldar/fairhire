// Pure upload helpers + types — no React/api imports, so they're unit-testable
// in isolation. The data hooks live in uploadApi.ts.

export const MAX_TRANSCRIPT_CHARS = 500_000;
export const ACCEPTED_TRANSCRIPT_EXT = '.txt';

export interface CandidateOption {
  id: string;
  name: string;
  roleAppliedFor: string;
}

export interface CreateMeetingInput {
  title: string;
  transcript: string;
  transcriptFilename?: string;
  date: string;
  candidateIds: string[];
}

/** Returns a user-facing error message, or null if the transcript is acceptable. */
export function validateTranscript(text: string): string | null {
  if (!text.trim()) return 'Add a transcript or upload a .txt file.';
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    return `Transcript is too long (max ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters).`;
  }
  return null;
}

/**
 * Validates a picked file is a .txt within size and returns its text.
 * Throws an Error with a user-facing message otherwise.
 */
export async function readTranscriptFile(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith(ACCEPTED_TRANSCRIPT_EXT)) {
    throw new Error('Only .txt files are supported.');
  }
  if (file.size > MAX_TRANSCRIPT_CHARS) {
    throw new Error(`File is too large (max ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters).`);
  }
  return file.text();
}
