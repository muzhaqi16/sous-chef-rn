import { mergedLocale } from '#/test-utils/mergedLocales';
import fs from 'fs';
import path from 'path';

/**
 * Every i18n key a source file names must exist in en.json.
 *
 * A literal passed to `t(...)` is checked by the compiler: `t` takes a
 * `TranslationKey` (`src/i18n/i18next.d.ts`). What the types cannot see is a key
 * STORED in a plain-string slot for a consumer to resolve later, or a prefix a
 * consumer completes at runtime. So this matches every literal whose first
 * segment is a real en.json namespace and requires it to name a message or a
 * subtree. Comments are skipped — see `stripComments`.
 */
const SRC = path.join(__dirname, '..', '..', 'src');

const SKIP_DIR = /(__tests__|__mocks__|[/\\]generated[/\\]|\.generated\.)/;

/** i18next plural/context suffixes — `t('x', {count})` resolves x_one / x_other. */
const PLURAL_SUFFIXES = ['_one', '_other', '_zero', '_two', '_few', '_many'];

/**
 * A filename can open with a namespace: `profile.jpg` starts with `profile`.
 * A key is matched on its first segment alone, so assets are excluded by suffix.
 * No en.json key ends in any of these segments, so nothing real is hidden.
 */
const ASSET_FILE = /\.(png|jpg|jpeg|gif|webp|svg|heic|mp3|mp4|json|txt|pdf)$/i;

/** Single- and double-quoted literals. A backtick means the key is built at runtime. */
const STRING_LITERAL = /'([^'\\\n]*)'|"([^"\\\n]*)"/g;

/** Strings and template literals first, so a comment opener inside one is not one. */
const TOKEN =
  /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;

/**
 * Blanks comment bodies, keeping newlines so reported line numbers stay true.
 *
 * Prose names keys too. A doc comment explaining a key-related pitfall spells
 * out the wrong key it is warning about, and a scan of raw text reports that
 * example as a real one — so the comment gets reworded to appease a scanner
 * rather than to read well. The scan makes this acute: it claims every key-shaped
 * literal, not just the argument of a `t(...)` call.
 *
 * Strings and template literals are consumed as whole tokens ahead of the
 * comment patterns, so the `//` inside `'https://example.com'` is not read as a
 * comment opener and an apostrophe inside a comment is not read as a quote.
 */
function stripComments(source: string): string {
  return source.replace(TOKEN, token =>
    token.startsWith('//') || token.startsWith('/*')
      ? token.replace(/[^\n]/g, ' ')
      : token,
  );
}

function collectFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (SKIP_DIR.test(full)) return [];
    if (entry.isDirectory()) return collectFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

type NodeKind = 'message' | 'subtree';

/**
 * Every path in en.json, tagged by what sits at it. A stored literal may name a
 * subtree: a prefix a consumer completes at runtime.
 */
function indexKeys(
  node: unknown,
  prefix = '',
  into = new Map<string, NodeKind>(),
): Map<string, NodeKind> {
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(
      node as Record<string, unknown>,
    )) {
      const full = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string') {
        into.set(full, 'message');
      } else {
        into.set(full, 'subtree');
        indexKeys(value, full, into);
      }
    }
  }
  return into;
}

describe('i18n keys referenced in source', () => {
  const english: unknown = mergedLocale('en');
  const entries = indexKeys(english);

  /** The namespaces a stored key is anchored on, read from en.json rather than listed. */
  const namespaces = new Set(Object.keys(english as Record<string, unknown>));

  const withPlurals = (key: string, accept: (candidate: string) => boolean) =>
    accept(key) || PLURAL_SUFFIXES.some(suffix => accept(`${key}${suffix}`));

  const resolvesToNode = (key: string) =>
    withPlurals(key, candidate => entries.has(candidate));

  const sources = collectFiles(SRC).map(file => ({
    file,
    text: stripComments(fs.readFileSync(file, 'utf8')),
  }));

  /** `file:line -> key` for every match the rule claims and cannot resolve. */
  const scan = (
    pattern: RegExp,
    claims: (key: string) => boolean,
    resolves: (key: string) => boolean,
  ): string[] => {
    const missing: string[] = [];
    for (const { file, text } of sources) {
      for (const match of text.matchAll(pattern)) {
        const key = match[1] ?? match[2];
        if (!claims(key!) || resolves(key!)) continue;
        const line = text.slice(0, match.index).split('\n').length;
        missing.push(`${path.relative(SRC, file)}:${line} -> ${key}`);
      }
    }
    return missing;
  };

  it('keys held outside a t() call exist in en.json', () => {
    const startsWithNamespace = (key: string) => {
      const boundary = key.indexOf('.');
      return (
        boundary > 0 &&
        namespaces.has(key.slice(0, boundary)) &&
        !ASSET_FILE.test(key)
      );
    };

    expect(scan(STRING_LITERAL, startsWithNamespace, resolvesToNode)).toEqual(
      [],
    );
  });
});
