import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/**
 * docs/architecture.md lists exactly the layer map and the platform services
 * the code defines: a folder moved between layers, or a service added, fails
 * here until the doc says so.
 */
type LayerEntry = {
  name: string;
  layer: 'core' | 'mobile';
  patterns: string[];
};

const { LAYERS } = require('../../scripts/lib/layers.js') as {
  LAYERS: LayerEntry[];
};

const ROOT = path.join(__dirname, '..', '..');
const DOC = fs.readFileSync(path.join(ROOT, 'docs/architecture.md'), 'utf8');

/** The text under `heading`, up to the next heading of its level or above. */
const section = (heading: string): string => {
  const level = heading.match(/^#+/)?.[0].length ?? 0;
  const start = DOC.indexOf(`\n${heading}\n`);
  if (start < 0) throw new Error(`docs/architecture.md has no "${heading}"`);
  const rest = DOC.slice(start + heading.length + 2);
  const next = rest.search(new RegExp(`\\n#{1,${level}} `));
  return next < 0 ? rest : rest.slice(0, next);
};

/** The body rows of the table whose header starts with `firstColumn`. */
const tableRows = (text: string, firstColumn: string): string[][] => {
  const lines = text.split('\n');
  const header = lines.findIndex(line =>
    new RegExp(`^\\|\\s*${firstColumn}\\s*\\|`).test(line),
  );
  if (header < 0) throw new Error(`no table headed "${firstColumn}"`);
  const rows: string[][] = [];
  for (const line of lines.slice(header + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(
      line
        .slice(1, -1)
        .split('|')
        .map(cell => cell.trim()),
    );
  }
  return rows;
};

const unquote = (cell: string) => cell.replace(/^`|`$/g, '');

describe('docs/architecture.md § Layers', () => {
  it('lists every layer-map entry with its layer and paths', () => {
    const documented = tableRows(section('## Layers'), 'Entry').map(
      ([name = '', layer = '', paths = '']) => ({
        name,
        layer,
        patterns: (paths.match(/`[^`]+`/g) ?? []).map(
          cell => `src/${unquote(cell)}`,
        ),
      }),
    );

    expect(documented).toEqual(LAYERS);
  });
});

describe('docs/architecture.md § Platform ports', () => {
  it('lists every platform service', () => {
    const file = path.join(ROOT, 'src/platform/ports.ts');
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
    );
    const services = source.statements.find(
      (statement): statement is ts.InterfaceDeclaration =>
        ts.isInterfaceDeclaration(statement) &&
        statement.name.text === 'PlatformServices',
    );
    const defined = (services?.members ?? [])
      .map(member => member.name?.getText(source) ?? '')
      .sort();

    const documented = tableRows(section('### Platform ports'), 'Service')
      .map(([service = '']) => unquote(service))
      .sort();

    expect(documented).toEqual(defined);
  });
});
