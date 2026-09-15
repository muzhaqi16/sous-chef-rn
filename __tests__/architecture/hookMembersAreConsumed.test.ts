import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { SRC, walk } from '#/test-utils/queueableOperations';

/**
 * A hook member no production code reads is either dead or a gap: a `loadMore`
 * nobody calls caps a list at its first page, an `error` nobody renders hides a
 * failure. knip sees only modules and exports, so this resolves each member of a
 * returned object literal through the language service.
 */
const ROOT = path.join(SRC, '..');

const isTestFile = (file: string) =>
  /(^|\/)(__tests__|__mocks__)\//.test(file) ||
  /\.(test|spec)\.tsx?$/.test(file);

jest.setTimeout(600_000);

const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;

function returnedObjects(
  fn: ts.FunctionLikeDeclaration,
): ts.ObjectLiteralExpression[] {
  const { body } = fn;
  if (!body) return [];
  if (!ts.isBlock(body)) {
    const expression = unwrap(body);
    return ts.isObjectLiteralExpression(expression) ? [expression] : [];
  }
  const found: ts.ObjectLiteralExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression) {
      const expression = unwrap(node.expression);
      if (ts.isObjectLiteralExpression(expression)) found.push(expression);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(body, visit);
  return found;
}

function exportedHooks(
  source: ts.SourceFile,
): Array<[string, ts.FunctionLikeDeclaration]> {
  const hooks: Array<[string, ts.FunctionLikeDeclaration]> = [];
  ts.forEachChild(source, node => {
    const exported =
      ts.canHaveModifiers(node) &&
      ts
        .getModifiers(node)
        ?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) return;
    if (ts.isFunctionDeclaration(node) && node.name) {
      hooks.push([node.name.text, node]);
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer;
        if (
          ts.isIdentifier(decl.name) &&
          init &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        ) {
          hooks.push([decl.name.text, init]);
        }
      }
    }
  });
  return hooks.filter(([name]) => /^use[A-Z]/.test(name));
}

describe('every member a hook returns is read by production code', () => {
  const files = walk(SRC, name => /\.tsx?$/.test(name)).filter(
    file => !isTestFile(file),
  );
  const hookFiles = files.filter(
    file =>
      (/\/features\/[^/]+\/hooks\//.test(file) || /\/src\/hooks\//.test(file)) &&
      !file.endsWith('.generated.ts'),
  );

  it('finds the hooks at all', () => {
    expect(hookFiles.length).toBeGreaterThan(100);
  });

  it('leaves no returned member unread', () => {
    const parsed = ts.parseJsonConfigFileContent(
      ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile)
        .config,
      ts.sys,
      ROOT,
    );
    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => files,
      getScriptVersion: () => '1',
      getScriptSnapshot: file =>
        fs.existsSync(file)
          ? ts.ScriptSnapshot.fromString(fs.readFileSync(file, 'utf8'))
          : undefined,
      getCurrentDirectory: () => ROOT,
      getCompilationSettings: () => ({ ...parsed.options, noEmit: true }),
      getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    };
    const service = ts.createLanguageService(host);
    const program = service.getProgram();
    if (!program) throw new Error('the language service built no program');
    const checker = program.getTypeChecker();

    // A member spread into props the component declares, or into another
    // object, is read through that object rather than by name.
    const keyOf = (node: ts.Node) =>
      `${node.getSourceFile().fileName}:${node.getStart()}`;
    const readBySpread = new Set<string>();
    for (const file of files) {
      const source = program.getSourceFile(file);
      if (!source) continue;
      const visit = (node: ts.Node) => {
        if (ts.isJsxSpreadAttribute(node) || ts.isSpreadAssignment(node)) {
          const props = ts.isJsxSpreadAttribute(node)
            ? checker.getContextualType(node.parent)
            : undefined;
          const type = checker.getTypeAtLocation(node.expression);
          for (const member of checker.getPropertiesOfType(type)) {
            if (props && !checker.getPropertyOfType(props, member.getName())) {
              continue;
            }
            for (const decl of member.declarations ?? []) {
              readBySpread.add(keyOf(decl));
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }

    // A declared return type names every member, so its signatures are not reads.
    const declaresType = (fileName: string, position: number) => {
      const source = program.getSourceFile(fileName);
      if (!source) return false;
      const find = (node: ts.Node): ts.Node | undefined =>
        position >= node.getStart(source) && position < node.getEnd()
          ? (ts.forEachChild(node, find) ?? node)
          : undefined;
      const node = find(source);
      return (
        !!node &&
        (ts.isPropertySignature(node.parent) ||
          ts.isMethodSignature(node.parent))
      );
    };

    const unread = new Set<string>();
    let members = 0;
    for (const file of hookFiles) {
      const source = program.getSourceFile(file);
      if (!source) continue;
      const rel = path.relative(ROOT, file);
      for (const [hookName, fn] of exportedHooks(source)) {
        const start = fn.getStart(source);
        const end = fn.getEnd();
        const check = (object: ts.ObjectLiteralExpression, prefix: string) => {
          for (const member of object.properties) {
            if (
              !(
                ts.isPropertyAssignment(member) ||
                ts.isShorthandPropertyAssignment(member) ||
                ts.isMethodDeclaration(member)
              ) ||
              !ts.isIdentifier(member.name)
            ) {
              continue;
            }
            const name = `${prefix}${member.name.text}`;
            if (ts.isPropertyAssignment(member)) {
              const value = unwrap(member.initializer);
              if (ts.isObjectLiteralExpression(value)) {
                check(value, `${name}.`);
              }
            }
            members += 1;
            const references =
              service.findReferences(file, member.name.getStart(source)) ?? [];
            const read = references.some(group =>
              group.references.some(
                ref =>
                  !ref.isDefinition &&
                  !(
                    ref.fileName === file &&
                    ref.textSpan.start >= start &&
                    ref.textSpan.start < end
                  ) &&
                  !declaresType(ref.fileName, ref.textSpan.start),
              ),
            );
            if (!read && !readBySpread.has(keyOf(member))) {
              unread.add(`${rel} ${hookName} → ${name}`);
            }
          }
        };
        for (const object of returnedObjects(fn)) check(object, '');
      }
    }

    expect(members).toBeGreaterThan(1000);
    expect([...unread]).toEqual([]);
  });
});
