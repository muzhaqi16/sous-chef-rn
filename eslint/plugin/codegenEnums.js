const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_TYPES = path.join(
  __dirname,
  '..',
  '..',
  'src',
  'graphql',
  'generated',
  'schemaTypes.ts',
);

let enums;

/**
 * The generated enums, `name → [{ member, value }]`, parsed once per process
 * from `schemaTypes.ts`.
 */
function readCodegenEnums() {
  if (enums) return enums;
  enums = new Map();
  const source = fs.readFileSync(SCHEMA_TYPES, 'utf8');
  // Closed by a brace at line start: member JSDoc can hold `{@link …}`.
  for (const block of source.matchAll(/export enum (\w+) \{([\s\S]*?)\n\}/g)) {
    enums.set(
      block[1],
      [...block[2].matchAll(/^\s*(\w+) = '([^']*)'/gm)].map(member => ({
        member: member[1],
        value: member[2],
      })),
    );
  }
  return enums;
}

module.exports = { readCodegenEnums };
