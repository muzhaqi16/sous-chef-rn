import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import {
  buildSchema,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
} from 'graphql';

/**
 * No code, tests and e2e included, names a field the API deprecates. Typed
 * reads and `.graphql` documents are held by lint; this holds what neither
 * sees, such as a mock's or a queued write's `variables` written as a plain
 * object.
 */
const { PRODUCTION_ROOTS } = require('../../scripts/lib/sourceRoots.js') as {
  PRODUCTION_ROOTS: string[];
};

const ROOT = path.join(__dirname, '..', '..');
const SCANNED_ROOTS = [...PRODUCTION_ROOTS, '__tests__', 'e2e'];

const schema = buildSchema(
  fs.readFileSync(
    path.join(ROOT, 'src', 'graphql', 'generated', 'schema.graphql'),
    'utf8',
  ),
);

/** Each deprecated field or input field, by name, with where it is declared. */
const deprecated = new Map<string, string[]>();
for (const type of Object.values(schema.getTypeMap())) {
  if (type.name.startsWith('__')) continue;
  if (
    !isObjectType(type) &&
    !isInterfaceType(type) &&
    !isInputObjectType(type)
  ) {
    continue;
  }
  for (const field of Object.values(type.getFields())) {
    if (field.deprecationReason == null) continue;
    const owners = deprecated.get(field.name) ?? [];
    deprecated.set(field.name, [...owners, type.name]);
  }
}

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const scanned = SCANNED_ROOTS.flatMap(root => filesUnder(path.join(ROOT, root)))
  .map(file => path.relative(ROOT, file).split(path.sep).join('/'))
  .filter(
    file =>
      /\.tsx?$/.test(file) &&
      !file.endsWith('.d.ts') &&
      !file.includes('.generated.') &&
      !file.startsWith('src/graphql/generated/'),
  );

/** A name in code (a key, a property read, a binding or a string), never a comment. */
function namedIn(node: ts.Node): string | null {
  if (
    (ts.isPropertyAssignment(node) || ts.isPropertySignature(node)) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
  ) {
    return node.name.text;
  }
  if (ts.isShorthandPropertyAssignment(node)) return node.name.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
    const named = node.propertyName ?? node.name;
    return ts.isIdentifier(named) ? named.text : null;
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function deprecatedNamesIn(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(path.join(ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    const name = namedIn(node);
    if (name !== null && deprecated.has(name)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${file}:${line + 1} ${name}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('no code names a deprecated field', () => {
  it('finds the deprecated fields and the files at all', () => {
    expect(deprecated.size).toBeGreaterThan(0);
    expect(scanned.length).toBeGreaterThan(100);
  });

  it('names none of them', () => {
    const offenders = scanned.flatMap(deprecatedNamesIn);
    expect(
      offenders.length === 0
        ? true
        : `Deprecated fields named: ${offenders
            .map(hit => {
              const name = hit.split(' ')[1] ?? '';
              return `${hit} (${(deprecated.get(name) ?? []).join(', ')})`;
            })
            .join(
              '; ',
            )}. Use the field its @deprecated reason names, or drop it.`,
    ).toBe(true);
  });
});
