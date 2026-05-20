import { createHash } from 'crypto';
import OpenAI from 'openai';
import { LLMResponseSchema } from './schema';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt';
import type { FlagCandidate } from '../types';

const DEFAULT_MODEL = 'gpt-4o-2024-08-06';

// Returns a non-PII fingerprint of an LLM response string. LLM responses
// echo transcript excerpts (candidate names, demographics, evaluative
// language); raw-dumping them to logs leaks sensitive content. The fingerprint
// is enough to correlate the same bad payload across runs without revealing it.
function fingerprint(s: string): string {
  return `${s.length}B/sha256=${createHash('sha256').update(s).digest('hex').slice(0, 12)}`;
}

// SYSTEM_PROMPT instructs the model to omit flags it is <0.5 confident in.
// The schema accepts any value in [0,1] (type-valid range) so a single
// misbehaving entry does not nuke the whole array into the retry path; we
// enforce the prompt's floor here as a business rule instead.
const MIN_LLM_CONFIDENCE = 0.5;

export function enforceConfidenceFloor(flags: FlagCandidate[]): FlagCandidate[] {
  const kept = flags.filter((f) => f.confidenceScore >= MIN_LLM_CONFIDENCE);
  const dropped = flags.length - kept.length;
  if (dropped > 0) {
    console.warn(`[LLMAnalyser] Dropped ${dropped} flag(s) below confidence floor ${MIN_LLM_CONFIDENCE}`);
  }
  return kept;
}

// Cap any single OpenAI request — without this a hung connection would wedge
// the background job indefinitely (SDK default is ~10 min). On timeout the
// SDK throws and the existing catch returns { ok: false } → the run completes
// degraded (rules-only). 60s is comfortably above normal latency for our
// short transcripts; if it ever fires, something is genuinely wrong.
const OPENAI_TIMEOUT_MS = 60_000;

export class LLMAnalyser {
  private _client: OpenAI | null = null;
  readonly modelVersion: string;

  constructor() {
    // `||` not `??`: an empty OPENAI_MODEL= in .env is a set-but-blank string,
    // which `??` would NOT fall back on, sending model: '' to OpenAI.
    this.modelVersion = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  }

  private get client(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this._client;
  }

  // `ok: false` means the LLM layer hard-failed (API error or unparseable
  // after one retry) and the result is rules-only. Callers must surface this
  // rather than treat an empty list as "the model found nothing".
  async analyse(transcript: string): Promise<{ flags: FlagCandidate[]; ok: boolean }> {
    const userMessage = buildUserMessage(transcript);

    try {
      const raw = await this.callModel(userMessage);
      const parsed = LLMResponseSchema.safeParse(raw);
      if (parsed.success) return { flags: enforceConfidenceFloor(parsed.data.flags), ok: true };

      // One retry with an explicit schema reminder
      console.warn('[LLMAnalyser] First parse failed, retrying with schema reminder');
      const rawRetry = await this.callModel(userMessage, true);
      const parsedRetry = LLMResponseSchema.safeParse(rawRetry);
      if (parsedRetry.success) return { flags: enforceConfidenceFloor(parsedRetry.data.flags), ok: true };

      // Zod's flatten() shows which fields failed and the expected types —
      // those are non-PII, safe to log. The response itself is fingerprinted,
      // not dumped.
      console.error('[LLMAnalyser] Retry parse failed. Validation error:', parsedRetry.error.flatten());
      console.error('[LLMAnalyser] Retry response fingerprint:', fingerprint(JSON.stringify(rawRetry)));
      return { flags: [], ok: false };
    } catch (err) {
      console.error('[LLMAnalyser] OpenAI call failed:', err);
      return { flags: [], ok: false };
    }
  }

  private async callModel(userMessage: string, schemaReminder = false): Promise<unknown> {
    const systemContent = schemaReminder
      ? `${SYSTEM_PROMPT}\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the JSON object described above with no other text.`
      : SYSTEM_PROMPT;

    const response = await this.client.chat.completions.create(
      {
        model: this.modelVersion,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
      },
      { timeout: OPENAI_TIMEOUT_MS },
    );

    const content = response.choices[0]?.message?.content ?? '{}';
    try {
      return JSON.parse(content);
    } catch {
      // Fingerprint, not content — see the helper at the top of this file.
      console.error('[LLMAnalyser] Failed to parse JSON. Response fingerprint:', fingerprint(content));
      return {};
    }
  }
}
