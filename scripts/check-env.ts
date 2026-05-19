const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'INTERNAL_API_SECRET',
  'OPENAI_API_KEY',
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('All required env vars present.');
