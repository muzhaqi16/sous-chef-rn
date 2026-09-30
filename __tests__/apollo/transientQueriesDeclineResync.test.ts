/**
 * A transient query — a search, an analytics view, a preview or lookup driven
 * by what the person typed — declines the client's resync with
 * `refetchOn: false`. Resync re-requests every active watcher on foreground,
 * API reachability and socket reconnect (`src/apollo/refetchEvents.ts`); a
 * search re-run then is a burst that answers a question nobody is asking.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { SRC, walk } from '#/test-utils/queueableOperations';

/** Searches and analytics by name; the previews and lookups by document. */
const TRANSIENT =
  /^(?:Search\w*|Autocomplete\w*|\w*Analytics|ConvertQuantity|CanConvert|CanDeleteAccount|GetHomeByJoinCode|GetUnitBySymbol|ItemByUpcFilter|ItemBySkuFilter)Document$/;

const QUERY_HOOKS = new Set(['useQuery', 'useLazyQuery']);

/** The options objects a call can receive: both arms of `cond ? {…} : skipToken`. */
const optionObjects = (
  options: ts.Expression | undefined,
): ts.ObjectLiteralExpression[] => {
  if (!options) return [];
  if (ts.isObjectLiteralExpression(options)) return [options];
  if (ts.isParenthesizedExpression(options)) {
    return optionObjects(options.expression);
  }
  if (ts.isConditionalExpression(options)) {
    return [
      ...optionObjects(options.whenTrue),
      ...optionObjects(options.whenFalse),
    ];
  }
  return [];
};

const declinesResync = (options: ts.ObjectLiteralExpression): boolean =>
  options.properties.some(
    property =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === 'refetchOn' &&
      property.initializer.kind === ts.SyntaxKind.FalseKeyword,
  );

const transientCallSites = () => {
  const sites: Array<{ site: string; declines: boolean }> = [];
  const files = walk(
    SRC,
    name => /\.tsx?$/.test(name) && !name.endsWith('.generated.ts'),
  ).filter(file => !/[\\/]__mocks__[\\/]/.test(file));

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        QUERY_HOOKS.has(node.expression.text)
      ) {
        const [document, options] = node.arguments;
        if (
          document &&
          ts.isIdentifier(document) &&
          TRANSIENT.test(document.text)
        ) {
          // Every object the call can receive declines; a variable does not count.
          const objects = optionObjects(options);
          sites.push({
            site: `${path.relative(SRC, file)} ${document.text}`,
            declines: objects.length > 0 && objects.every(declinesResync),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return sites;
};

describe('transient queries', () => {
  const sites = transientCallSites();

  it('finds the transient call sites', () => {
    expect(sites.length).toBeGreaterThan(10);
  });

  it('reads options passed through a `cond ? {…} : skipToken`', () => {
    expect(sites).toContainEqual({
      site:
        path.join('features', 'pantry', 'hooks', 'useConversionPreview.ts') +
        ' CanConvertDocument',
      declines: true,
    });
  });

  it('decline resync with refetchOn: false', () => {
    expect(sites.filter(({ declines }) => !declines).map(s => s.site)).toEqual(
      [],
    );
  });
});
