import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The rules that read types, in one suite: each suite that starts TypeScript's
 * project service spends about 18 s on CI before its first case, and this one
 * starts it once. A spec in `typedRules/` runs here.
 */
const SPECS = path.join(__dirname, 'typedRules');

for (const spec of fs.readdirSync(SPECS)) {
  require(path.join(SPECS, spec));
}
