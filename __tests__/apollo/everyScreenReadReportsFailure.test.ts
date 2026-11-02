import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/**
 * A read that fails with nothing held must not look like an empty answer. The
 * one place that can tell is the code holding the query's result, so a hook
 * that hands a value on reads `error`: into `useDataState`, its own state, or
 * `useApolloErrorLogger` when nothing it returns can read as "none". A hook
 * that returns nothing shows nothing, and the error link records its failure.
 */
const SRC = path.join(__dirname, '..', '..', 'src');

const productionFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return /^__(tests|mocks)__$/.test(entry.name) ? [] : productionFiles(full);
    }
    return /\.tsx?$/.test(entry.name) &&
      !/\.(generated|test|d)\.tsx?$/.test(entry.name)
      ? [full]
      : [];
  });

const isUseQuery = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === 'useQuery';

const enclosingFunction = (node: ts.Node): ts.Node | undefined => {
  let at: ts.Node | undefined = node.parent;
  while (at && !ts.isFunctionLike(at)) at = at.parent;
  return at;
};

const returnsValue = (fn: ts.Node): boolean => {
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return true;
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found || (ts.isFunctionLike(node) && node !== fn)) return;
    if (ts.isReturnStatement(node) && node.expression) found = true;
    ts.forEachChild(node, visit);
  };
  visit(fn);
  return found;
};

const mentionsError = (name: string, fn: ts.Node): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === name &&
      node.name.text === 'error'
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(fn);
  return found;
};

/** Whether the code holding a query's result reads its `error`. */
function readsError(call: ts.CallExpression, fn: ts.Node): boolean {
  const { parent } = call;
  if (ts.isReturnStatement(parent)) return true;
  if (ts.isArrowFunction(parent) && parent.body === call) return true;
  if (!ts.isVariableDeclaration(parent)) return false;
  const { name } = parent;
  if (ts.isIdentifier(name)) return mentionsError(name.text, fn);
  return (
    ts.isObjectBindingPattern(name) &&
    name.elements.some(element => {
      const bound = element.propertyName ?? element.name;
      return ts.isIdentifier(bound) && bound.text === 'error';
    })
  );
}

const silentReads = (): string[] =>
  productionFiles(SRC).flatMap(file => {
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('useQuery(')) return [];
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const found: string[] = [];
    const visit = (node: ts.Node): void => {
      if (isUseQuery(node)) {
        const fn = enclosingFunction(node);
        if (fn && returnsValue(fn) && !readsError(node, fn)) {
          const { line } = source.getLineAndCharacterOfPosition(node.pos);
          found.push(`${path.relative(SRC, file)}:${line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  });

const scan = (code: string) => {
  const source = ts.createSourceFile(
    'hook.ts',
    code,
    ts.ScriptTarget.Latest,
    true,
  );
  let held: boolean | undefined;
  const visit = (node: ts.Node): void => {
    if (isUseQuery(node)) {
      const fn = enclosingFunction(node);
      held = !!fn && (!returnsValue(fn) || readsError(node, fn));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return held;
};

describe('a read that hands a value on', () => {
  it('fails the scan when it never reads error', () => {
    expect(
      scan(`function useRows() {
        const { data } = useQuery(ROWS);
        return data?.rows ?? [];
      }`),
    ).toBe(false);
  });

  it('passes when it reads error, by name or through its result', () => {
    expect(
      scan(`function useRows() {
        const { data, error } = useQuery(ROWS);
        useApolloErrorLogger(ROWS, error);
        return data?.rows ?? [];
      }`),
    ).toBe(true);
    expect(
      scan(`function useRows() {
        const rows = useQuery(ROWS);
        const state = useDataState({ error: rows.error });
        return { rows: rows.data, state };
      }`),
    ).toBe(true);
  });

  it('passes when its hook returns nothing to show', () => {
    expect(
      scan(`function useSync() {
        const { data } = useQuery(ROWS);
        useEffect(() => { mirror(data); }, [data]);
      }`),
    ).toBe(true);
  });

  it('holds every production read', () => {
    expect(silentReads()).toEqual([]);
  });
});
