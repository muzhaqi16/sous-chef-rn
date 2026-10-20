import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/**
 * A write to server-owned data is issued by a core-layer hook, so it behaves
 * the same under every host and runs with no device. A screen, component or
 * the hook beside them calls one; none imports `useMutation` itself. A host's
 * device services, which write records about the device (its push
 * registration, its stored credential), are host steps and call the client.
 */
type LayerEntry = {
  name: string;
  layer: 'core' | 'mobile';
  patterns: string[];
};

const { isProductionFile, matchingEntries } =
  require('../../scripts/lib/layers.js') as {
    isProductionFile: (file: string) => boolean;
    matchingEntries: (file: string) => LayerEntry[];
  };

const ROOT = path.join(__dirname, '..', '..');

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const mobileModules = filesUnder(path.join(ROOT, 'src'))
  .map(file => path.relative(ROOT, file).split(path.sep).join('/'))
  .filter(isProductionFile)
  .filter(file => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
  .filter(file => matchingEntries(file)[0]?.layer === 'mobile');

/** Whether the file imports `useMutation` from Apollo's React entry. */
const importsUseMutation = (file: string): boolean => {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(path.join(ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest,
  );
  return source.statements.some(
    statement =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === '@apollo/client/react' &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        element =>
          (element.propertyName ?? element.name).text === 'useMutation',
      ),
  );
};

it('has mobile modules to check', () => {
  expect(mobileModules.length).toBeGreaterThan(300);
});

it('issues no write from a mobile-layer module', () => {
  expect(mobileModules.filter(importsUseMutation)).toEqual([]);
});
