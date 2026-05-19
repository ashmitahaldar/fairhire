import OpenAI from 'openai';
import { LLMResponseSchema } from './schema';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt';
import type { FlagCandidate } from '../types';

const DEFAULT_MODEL = 'gpt-4o-2024-08-06';

export class LLMAnalyser {
  private _client: OpenAI | null = null;
  readonly modelVersion: string;

  constructor() {
    this.modelVersion = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
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
      if (parsed.success) return { flags: parsed.data.flags, ok: true };

      // One retry with an explicit schema reminder
      console.warn('[LLMAnalyser] First parse failed, retrying with schema reminder');
      const rawRetry = await this.callModel(userMessage, true);
      const parsedRetry = LLMResponseSchema.safeParse(rawRetry);
      if (parsedRetry.success) return { flags: parsedRetry.data.flags, ok: true };

      console.error('[LLMAnalyser] Retry parse failed. Validation error:', parsedRetry.error.flatten());
      console.error('[LLMAnalyser] Raw retry response:', JSON.stringify(rawRetry));
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

    const response = await this.client.chat.completions.create({
      model: this.modelVersion,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    try {
      return JSON.parse(content);
    } catch {
      console.error('[LLMAnalyser] Failed to parse JSON from response:', content);
      return {};
    }
  }
}
