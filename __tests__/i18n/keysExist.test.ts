import fs from 'fs';
import path from 'path';

/**
 * Every literal key passed to `t(...)` must exist in en.json.
 *
 * A missing key is not a no-op: `t()` returns the key itself, so the UI renders
 * a raw dot-path like "itemForm.brand". That is exactly the bug this guard was
 * written for — a key was referenced during the i18n sweep but never added to
 * the locale file, and it survived typecheck and lint because a key path is
 * just a string. Only a test that happened to assert the English caught it.
 *
 * Dynamic keys (template literals, variables, concatenations) are skipped:
 * they cannot be resolved statically, and the call sites that build them pass
 * an explicit fallback.
 */
const SRC = path.join(__dirname, '..', '..', 'src');
const EN = path.join(SRC, 'i18n', 'locales', 'en.json');

const SKIP_DIR = /(__tests__|__mocks__|[/\\]generated[/\\]|\.generated\.)/;

/** i18next plural/context suffixes — `t('x', {count})` resolves x_one / x_other. */
const PLURAL_SUFFIXES = ['_one', '_other', '_zero', '_two', '_few', '_many'];

function collectFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (SKIP_DIR.test(full)) return [];
    if (entry.isDirectory()) return collectFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function flatten(node: unknown, prefix = ''): Set<string> {
  const keys = new Set<string>();
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') {
        keys.add(full);
      } else {
        for (const nested of flatten(v, full)) keys.add(nested);
      }
    }
  }
  return keys;
}

describe('i18n keys referenced in source', () => {
  const available = flatten(JSON.parse(fs.readFileSync(EN, 'utf8')));

  const resolves = (key: string) =>
    available.has(key) ||
    PLURAL_SUFFIXES.some(suffix => available.has(`${key}${suffix}`));

  it('all exist in en.json', () => {
    // Single-quoted literal only: a backtick means the key is built at runtime.
    const CALL = /\bt\(\s*'([a-zA-Z][\w.]*\.[\w.]+)'/g;
    const missing: string[] = [];

    for (const file of collectFiles(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(CALL)) {
        const key = match[1];
        if (!resolves(key)) {
          const line = text.slice(0, match.index).split('\n').length;
          missing.push(`${path.relative(SRC, file)}:${line} -> ${key}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
