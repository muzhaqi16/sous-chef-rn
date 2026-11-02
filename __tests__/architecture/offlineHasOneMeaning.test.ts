import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/**
 * A feature asks one question about being offline: `useIsApiUnavailable`, the
 * decision the read path acts on. Raw `isOnline` still reads as online through
 * an API outage on working Wi-Fi, so only the transport beneath that decision
 * may read it.
 */
const { PRODUCTION_ROOTS } = require('../../scripts/lib/sourceRoots.js') as {
  PRODUCTION_ROOTS: string[];
};
const { isProductionFile } = require('../../scripts/lib/layers.js') as {
  isProductionFile: (file: string) => boolean;
};

const ROOT = path.join(__dirname, '..', '..');

const TRANSPORT = [
  /^src\/apollo\/(links|offlineQueue)\//,
  /^src\/store\//,
  /^src\/services\/telemetry\//,
  /^src\/hooks\/app\/useOnlineQueueSync\.ts$/,
  /^src\/hooks\/subscriptions\/useSubscriptionTransportRecovery\.ts$/,
];

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const productionModules = PRODUCTION_ROOTS.flatMap(root =>
  filesUnder(path.join(ROOT, root)),
)
  .map(file => path.relative(ROOT, file).split(path.sep).join('/'))
  .filter(isProductionFile)
  .filter(file => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'));

const isRawRead = (node: ts.Node): boolean =>
  (ts.isIdentifier(node) && node.text === 'useIsOnline') ||
  (ts.isPropertyAccessExpression(node) && node.name.text === 'isOnline') ||
  (ts.isBindingElement(node) &&
    ts.isObjectBindingPattern(node.parent) &&
    (node.propertyName ?? node.name).getText() === 'isOnline');

/** Whether the file reads raw connectivity, in code rather than a comment. */
const readsRawConnectivity = (file: string): boolean => {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(path.join(ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const visit = (node: ts.Node): boolean =>
    isRawRead(node) || (ts.forEachChild(node, visit) ?? false);
  return visit(source);
};

describe('offline has one meaning', () => {
  const readers = productionModules.filter(readsRawConnectivity);

  it('leaves raw connectivity to transport', () => {
    expect(
      readers.filter(file => !TRANSPORT.some(allowed => allowed.test(file))),
    ).toEqual([]);
  });

  // A scan that finds nothing anywhere would pass with its detection broken.
  it('finds the transport readers it allows', () => {
    expect(readers).toContain('src/hooks/app/useOnlineQueueSync.ts');
    expect(readers).toContain('src/store/useAppStore.ts');
  });
});
