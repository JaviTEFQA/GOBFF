/** scripts/build-contracts.ts — Re-infer contracts/<version>/ from recordings/<version>/.  npm run contracts:build [-- <version>] */
import { env } from '../src/config/env';
import { buildContracts } from '../src/contracts/registry';
import { loadExchanges, writeInventory } from '../src/recordings/store';

const version = process.argv[2] ?? env.appVersion;
const exchanges = loadExchanges(version);
writeInventory(exchanges, version);
const files = buildContracts(exchanges, version);
console.log(`[contracts] ${version}: ${files.length} contracts from ${exchanges.length} exchanges`);
