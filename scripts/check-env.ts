// Hard-required: the API cannot serve a single request without these.
const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'INTERNAL_API_SECRET',
];

// Recommended: the LLM analysis layer degrades to rules-only at runtime when
// these are missing (LLMAnalyser returns { ok: false }, the AnalysisRun is
// flagged as degraded). Treat as a soft warning so local rules-only
// iteration is not blocked, but still loud enough that a misconfigured
// deploy does not pass check-env silently.
const recommended = ['OPENAI_API_KEY'];

const missingRequired = required.filter((key) => !process.env[key]);
const missingRecommended = recommended.filter((key) => !process.env[key]);

if (missingRequired.length > 0) {
  console.error(`Missing required env vars: ${missingRequired.join(', ')}`);
  process.exit(1);
}

if (missingRecommended.length > 0) {
  console.warn(
    `Warning — missing recommended env vars: ${missingRecommended.join(', ')}\n` +
      '  → analysis will degrade to rules-only (no LLM layer).',
  );
}

console.log('All required env vars present.');
