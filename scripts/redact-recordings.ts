/**
 * scripts/redact-recordings.ts — Re-apply secret redaction to recordings already on disk.
 *
 *   npm run recordings:redact            # current APP_VERSION
 *   npm run recordings:redact -- 26.10.100
 *
 * New recordings are redacted when written (store.ts → redactBody / redactHeaders). This
 * cleans recordings made before a redaction rule existed (e.g. tokens in response bodies).
 */
import * as fs from 'fs';
import * as path from 'path';
import { env, paths } from '../src/config/env';
import { redactBody, redactHeaders, type RecordedExchange } from '../src/recordings/store';

const version = process.argv[2] ?? env.appVersion;
const root = paths.recordings(version);
let changed = 0;
let total = 0;
for (const dir of fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : []) {
  if (!dir.isDirectory()) continue;
  for (const f of fs.readdirSync(path.join(root, dir.name)).filter((x) => x.endsWith('.json'))) {
    const file = path.join(root, dir.name, f);
    const before = fs.readFileSync(file, 'utf8');
    const ex = JSON.parse(before) as RecordedExchange;
    ex.request.headers = redactHeaders(ex.request.headers);
    ex.response.headers = redactHeaders(ex.response.headers);
    ex.response.body = redactBody(ex.response.body);
    if (ex.request.body) ex.request.body = redactBody(ex.request.body) as string;
    const after = JSON.stringify(ex, null, 2);
    total++;
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed++;
    }
  }
}
console.log(`[redact] ${version}: ${changed} of ${total} recording(s) rewritten.`);
