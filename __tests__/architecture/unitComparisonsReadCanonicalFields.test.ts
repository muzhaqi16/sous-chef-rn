import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { formatQuantityDisplay } from '#/utils/formatQuantity';

/**
 * A unit's localized fields are what it reads as on screen, and differ by the
 * reader's language: a household member reading Italian and one reading English
 * hold the same litre. Matching, merging, converting and checking a unit read
 * its id, `symbol` or `name`. Only the label helper and the typed-unit search
 * read a localized field.
 */
const { isProductionFile } = require('../../scripts/lib/layers.js') as {
  isProductionFile: (file: string) => boolean;
};

const ROOT = path.join(__dirname, '..', '..');

const LOCALIZED_FIELDS = new Set([
  'localizedSymbol',
  'localizedName',
  'localizedSymbolForms',
  'localizedNameForms',
]);

// Display picks the label; search matches what the user typed against it.
const LABEL_READERS = new Set([
  'src/utils/formatQuantity.ts',
  'src/features/catalog/hooks/useUnitAutocomplete.ts',
  'src/features/catalog/hooks/useResolveUnit.ts',
]);

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const modules = filesUnder(path.join(ROOT, 'src'))
  .map(file => path.relative(ROOT, file).split(path.sep).join('/'))
  .filter(isProductionFile)
  .filter(file => /\.tsx?$/.test(file) && !/\.(d|generated)\.ts$/.test(file));

/** `file:line field` for each property read or destructure of a localized field. */
function localizedReads(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const reads: string[] = [];
  const record = (node: ts.Node, field: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    reads.push(`${file}:${line + 1} ${field}`);
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      LOCALIZED_FIELDS.has(node.name.text)
    ) {
      record(node, node.name.text);
    }
    if (ts.isBindingElement(node)) {
      const key = node.propertyName ?? node.name;
      if (ts.isIdentifier(key) && LOCALIZED_FIELDS.has(key.text)) {
        record(node, key.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return reads;
}

it('has modules to check', () => {
  expect(modules.length).toBeGreaterThan(1000);
});

it('reads a localized unit field only to show or search a unit', () => {
  expect(
    modules
      .filter(file => !LABEL_READERS.has(file))
      .flatMap(file =>
        localizedReads(file, fs.readFileSync(path.join(ROOT, file), 'utf8')),
      ),
  ).toEqual([]);
});

it('would catch a comparison that reads a localized field', () => {
  const comparison =
    'export const isMl = (unit: { localizedSymbol: string }) =>\n' +
    "  unit.localizedSymbol === 'mL';\n" +
    'export const nameOf = ({ localizedName }: { localizedName: string }) => localizedName;\n';
  expect(localizedReads('probe.ts', comparison)).toEqual([
    'probe.ts:2 localizedSymbol',
    'probe.ts:3 localizedName',
  ]);
});

describe('the label helper compares the canonical symbol', () => {
  it('upscales grams and millilitres by symbol, whatever the label', () => {
    expect(
      formatQuantityDisplay(1500, { symbol: 'g', localizedSymbol: 'gr' }),
    ).toBe('1.5 kg');
    expect(
      formatQuantityDisplay(1500, { symbol: 'mL', localizedSymbol: 'cc' }),
    ).toBe('1.5 L');
  });

  it('does not upscale a unit whose label only reads like grams', () => {
    expect(
      formatQuantityDisplay(1500, { symbol: 'pc', localizedSymbol: 'g' }),
    ).toBe('1500 g');
  });
});
