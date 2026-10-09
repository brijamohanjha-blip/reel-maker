// Load API keys from the environment, else from a .env file: $REEL_MAKER_ENV, ./.env, or the installed skill's .env.
// Values are never printed.
import {existsSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

export const loadEnv = () => {
  for (const file of [process.env.REEL_MAKER_ENV, '.env', join(homedir(), '.claude/skills/reel-maker/.env')]) {
    if (!file || !existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#\s]*)"?/);
      if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
};
