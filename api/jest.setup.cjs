// Load the repo-root .env into process.env before any test module is imported.
//
// Without this, the integration suites (INTEGRATION=1) crash at construction:
// systemPrisma passes `{ url: process.env.DIRECT_URL }` explicitly, so an
// undefined URL is a Prisma constructor validation error — not a lazy connect
// failure. The dev script loads env via `tsx --env-file=../.env`; jest had no
// equivalent, so the documented `INTEGRATION=1 npm -w api test` could never
// reach the DB. Harmless for the mock suites — they never connect.
//
// NB: we parse the file by hand rather than using process.loadEnvFile — jest
// sandboxes process.env as a copy, and loadEnvFile is a native binding that
// mutates the *real* environment, so jest's copy never sees the result. A
// plain JS assignment to process.env does land in the sandboxed copy.
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('='); // split on the FIRST = — values (e.g. DB URLs) contain = & ?
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue; // don't override anything already set
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
