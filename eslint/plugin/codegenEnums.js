const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

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
  const source = ts.createSourceFile(
    SCHEMA_TYPES,
    fs.readFileSync(SCHEMA_TYPES, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    ts.ScriptKind.TS,
  );

  for (const statement of source.statements) {
    if (!ts.isEnumDeclaration(statement)) continue;
    enums.set(
      statement.name.text,
      statement.members.flatMap(member =>
        ts.isIdentifier(member.name) &&
        member.initializer &&
        ts.isStringLiteral(member.initializer)
          ? [{ member: member.name.text, value: member.initializer.text }]
          : [],
      ),
    );
  }

  // Fail closed: an empty map would make every consuming rule pass silently.
  if (enums.size === 0) {
    throw new Error(
      `No enums found in ${SCHEMA_TYPES}; run \`npm run codegen\`.`,
    );
  }
  return enums;
}

module.exports = { readCodegenEnums };
