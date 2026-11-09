/** scripts/print-inventory.ts — Table of every canoway endpoint the app called.  npm run inventory [-- <version>] */
import { env } from '../src/config/env';
import { buildInventory, loadExchanges } from '../src/recordings/store';

const version = process.argv[2] ?? env.appVersion;
const inv = buildInventory(loadExchanges(version));
if (!inv.length) {
  console.log(`No recordings for ${version}. Run "npm run record".`);
} else {
  console.table(inv.map((e) => ({ endpoint: e.endpointId, samples: e.samples, status: e.statuses.join(','), screens: e.journeys.join(', ') })));
}
