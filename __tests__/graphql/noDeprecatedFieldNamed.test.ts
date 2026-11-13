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
 * object. A name that a live field also carries is judged by the type it is
 * named on, since the name alone cannot say which field is meant.
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
/** Names a live field or input field carries too. */
const liveNames = new Set<string>();
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
    if (field.deprecationReason == null) {
      liveNames.add(field.name);
      continue;
    }
    const owners = deprecated.get(field.name) ?? [];
    deprecated.set(field.name, [...owners, type.name]);
  }
}
const isShared = (name: string): boolean => liveNames.has(name);

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

interface Hit {
  file: string;
  line: number;
  name: string;
  node: ts.Node;
}

function deprecatedNamesIn(file: string, source: ts.SourceFile): Hit[] {
  const found: Hit[] = [];
  const visit = (node: ts.Node) => {
    const name = namedIn(node);
    if (name !== null && deprecated.has(name)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      found.push({ file, line: line + 1, name, node });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const parse = (file: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    fs.readFileSync(path.join(ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

function programOf(files: string[]): ts.Program {
  const { config } = ts.readConfigFile(
    path.join(ROOT, 'tsconfig.json'),
    ts.sys.readFile,
  );
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, ROOT);
  return ts.createProgram(
    files.map(file => path.join(ROOT, file)),
    { ...options, noEmit: true },
  );
}

/** The type a mention is named on: what it is a key, a read or an index of. */
function typeNamedOn(checker: ts.TypeChecker, node: ts.Node): ts.Type | null {
  const { parent } = node;
  if (ts.isPropertyAccessExpression(node)) {
    return checker.getTypeAtLocation(node.expression);
  }
  if (
    (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
    ts.isObjectLiteralExpression(parent)
  ) {
    return checker.getContextualType(parent) ?? null;
  }
  if (ts.isBindingElement(node)) return checker.getTypeAtLocation(parent);
  if (
    ts.isElementAccessExpression(parent) &&
    parent.argumentExpression === node
  ) {
    return checker.getTypeAtLocation(parent.expression);
  }
  if (
    ts.isLiteralTypeNode(parent) &&
    ts.isIndexedAccessTypeNode(parent.parent) &&
    parent.parent.indexType === parent
  ) {
    return checker.getTypeFromTypeNode(parent.parent.objectType);
  }
  return null;
}

/** The generated GraphQL types that declare `name` on the type it is named on. */
function ownersOf(
  checker: ts.TypeChecker,
  type: ts.Type,
  name: string,
): string[] {
  const nonNull = checker.getNonNullableType(type);
  const members = nonNull.isUnion() ? nonNull.types : [nonNull];
  return members.flatMap(member =>
    (checker.getPropertyOfType(member, name)?.declarations ?? []).flatMap(
      declaration => {
        const file = declaration.getSourceFile().fileName;
        if (!file.includes('/src/graphql/generated/')) return [];
        let owner: ts.Node | undefined = declaration.parent;
        while (owner && !ts.isTypeAliasDeclaration(owner)) owner = owner.parent;
        return owner ? [owner.name.text] : [];
      },
    ),
  );
}

function isOnADeprecatedOwner(checker: ts.TypeChecker, hit: Hit): boolean {
  const type = typeNamedOn(checker, hit.node);
  if (!type) return false;
  const owners = deprecated.get(hit.name) ?? [];
  return ownersOf(checker, type, hit.name).some(owner =>
    owners.includes(owner),
  );
}

const report = (hit: Hit): string =>
  `${hit.file}:${hit.line} ${hit.name} (${(deprecated.get(hit.name) ?? []).join(
    ', ',
  )})`;

function offenders(): string[] {
  const hits = scanned.flatMap(file => deprecatedNamesIn(file, parse(file)));
  const strict = hits.filter(hit => !isShared(hit.name));
  const sharedFiles = [
    ...new Set(hits.filter(hit => isShared(hit.name)).map(hit => hit.file)),
  ];
  if (sharedFiles.length === 0) return strict.map(report);

  const program = programOf(sharedFiles);
  const checker = program.getTypeChecker();
  const typed = sharedFiles.flatMap(file => {
    const source = program.getSourceFile(path.join(ROOT, file));
    if (!source) throw new Error(`${file} is missing from the program`);
    return deprecatedNamesIn(file, source).filter(
      hit => isShared(hit.name) && isOnADeprecatedOwner(checker, hit),
    );
  });
  return [...strict, ...typed].map(report);
}

describe('no code names a deprecated field', () => {
  it('finds the deprecated fields and the files at all', () => {
    expect(deprecated.size).toBeGreaterThan(0);
    expect(scanned.length).toBeGreaterThan(100);
  });

  it('names none of them', () => {
    const found = offenders();
    expect(
      found.length === 0
        ? true
        : `Deprecated fields named: ${found.join(
            '; ',
          )}. Use the field its @deprecated reason names, or drop it.`,
    ).toBe(true);
  });
});
