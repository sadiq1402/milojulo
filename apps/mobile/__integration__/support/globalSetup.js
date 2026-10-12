const { execSync } = require('child_process');
const path = require('path');

// Uses the running local stack unless CI passes the values in.
module.exports = async () => {
  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.MAILPIT_URL
  ) {
    return;
  }
  const out = execSync('npx supabase status -o env', {
    cwd: path.resolve(__dirname, '../../../..'),
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();
  const vars = Object.fromEntries(
    out
      .split('\n')
      .map(line => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter(Boolean)
      .map(m => [m[1], m[2]]),
  );
  process.env.SUPABASE_URL ??= vars.API_URL;
  process.env.SUPABASE_ANON_KEY ??= vars.ANON_KEY;
  process.env.MAILPIT_URL ??= vars.MAILPIT_URL ?? vars.INBUCKET_URL;
};
