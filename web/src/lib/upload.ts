// Pure upload helpers + types — no React/api imports, so they're unit-testable
// in isolation. The data hooks live in uploadApi.ts.

export const MAX_TRANSCRIPT_CHARS = 500_000;
export const ACCEPTED_TRANSCRIPT_EXT = '.txt';

export interface CandidateOption {
  id: string;
  name: string;
  roleAppliedFor: string;
}

interface MeetingInputBase {
  title: string;
  transcript: string;
  transcriptFilename?: string;
  date: string;
  candidateIds: string[];
}

// Discriminated union mirroring the server's createMeetingBody. Hiring is
// the pre-Week-5 shape; promotion carries the three target-employee fields
// the route nests onto the first candidate. The form switches which branch
// it builds based on the selected tab.
export type CreateMeetingInput =
  | (MeetingInputBase & { meetingType: 'hiring' })
  | (MeetingInputBase & {
      meetingType: 'promotion';
      currentRole: string;
      tenureYears: number;
      lastPromotedAt?: string;
    });

export interface PromotionFields {
  currentRole: string;
  tenureYears: string; // raw form input; parsed/validated at submit
  lastPromotedAt: string; // optional yyyy-MM-dd; '' when unset
}

/**
 * Validates the promotion-only fields. Returns a user-facing error message,
 * or null if acceptable. Hiring uploads skip this entirely.
 */
export function validatePromotionFields(fields: PromotionFields): string | null {
  if (!fields.currentRole.trim()) return 'Add the employee’s current role or level.';
  const years = Number(fields.tenureYears);
  if (!fields.tenureYears.trim() || !Number.isFinite(years)) {
    return 'Add tenure in years (a whole number).';
  }
  if (!Number.isInteger(years) || years < 0 || years > 60) {
    return 'Tenure must be a whole number of years between 0 and 60.';
  }
  return null;
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
  // Decode first, then measure characters — file.size is bytes while the
  // server cap (Zod z.string().max(500_000)) measures JS string length, so a
  // non-ASCII transcript could otherwise be rejected at the wrong boundary
  // (UTF-8 inflates bytes-per-char) or sneak past the client check entirely.
  const text = await file.text();
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    throw new Error(`File is too large (max ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters).`);
  }
  return text;
}
