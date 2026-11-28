import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * `MarkHomeAsDefault` has exactly one writer.
 *
 * A second hook sending it is how the routes drift: only the local-first
 * one queues offline, and only the one that calls `applyDefaultHome` moves the
 * flag the UI reads (the payload never returns it).
 */
const SRC = path.join(__dirname, '..', '..', '..', '..');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !entry.name.includes('.generated')
    ) {
      out.push(full);
    }
  }
  return out;
};

describe('MarkHomeAsDefault', () => {
  it('is fired from useMarkHomeAsDefault and nowhere else', () => {
    const sources = walk(SRC).map(file => ({
      file,
      text: fs.readFileSync(file, 'utf8'),
    }));
    // A local write sends its document through the binding made for it.
    const bindings = sources.flatMap(({ text }) =>
      [
        ...text.matchAll(
          /const (\w+) = bindLocalWrite\(\s*MarkHomeAsDefaultDocument\b/g,
        ),
      ].map(([, name = '']) => name),
    );
    expect(bindings.length).toBeGreaterThan(0);

    const sends = new RegExp(
      `useMutation\\(\\s*MarkHomeAsDefaultDocument\\b|useLocalWrite\\(\\s*(${bindings.join(
        '|',
      )})\\b`,
    );
    const callers = sources
      .filter(({ text }) => sends.test(text))
      .map(({ file }) => file);

    expect(callers.map(file => path.relative(SRC, file))).toEqual([
      path.join('features', 'home', 'hooks', 'useMarkHomeAsDefault.ts'),
    ]);
  });
});
