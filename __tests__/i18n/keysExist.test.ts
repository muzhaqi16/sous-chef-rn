import fs from 'fs';
import path from 'path';

/**
 * Every i18n key a source file names must exist in en.json.
 *
 * A missing key is not a no-op: `t()` returns the key itself, so the UI renders
 * a raw dot-path like "itemForm.brand". That is exactly the bug this guard was
 * written for — a key was referenced during the i18n sweep but never added to
 * the locale file, and it survived typecheck and lint because a key path is
 * just a string. Only a test that happened to assert the English caught it.
 *
 * Two rules run over one scan of `src`, and neither contains the other:
 *
 * 1. **Literals passed to `t(...)`.** Reaches a key whose very first segment is
 *    wrong — `t('typo.notAKey')` — which rule 2 has no anchor for.
 * 2. **Literals whose first segment is a real en.json namespace.** Reaches the
 *    keys that never appear inside a `t(...)` call: module-level tables cannot
 *    call a hook, so they store a key path (`labelKey`, `titleKey`,
 *    `subtitleKey`, `descriptionKey`, `messageKey`) for a consumer to resolve.
 *    Those account for hundreds of key references across dozens of files, all
 *    of them invisible to rule 1.
 *
 * Dynamic keys (template literals, variables, concatenations) are skipped:
 * they cannot be resolved statically, and the call sites that build them pass
 * an explicit fallback. Comments are skipped too — see `stripComments`.
 */
const SRC = path.join(__dirname, '..', '..', 'src');
const EN = path.join(SRC, 'i18n', 'locales', 'en.json');

const SKIP_DIR = /(__tests__|__mocks__|[/\\]generated[/\\]|\.generated\.)/;

/** i18next plural/context suffixes — `t('x', {count})` resolves x_one / x_other. */
const PLURAL_SUFFIXES = ['_one', '_other', '_zero', '_two', '_few', '_many'];

/**
 * A filename can open with a namespace: `profile.jpg` starts with `profile`.
 * Rule 2 matches on the first segment alone, so assets are excluded by suffix.
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
 * rather than to read well. Rule 2 makes this acute: it claims every key-shaped
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
 * Every path in en.json, tagged by what sits at it.
 *
 * The distinction is the point: a `t(...)` argument has to land on a message,
 * while rule 2 also accepts a subtree, because `keyPrefix: 'itemPhotos.setPrimary'`
 * names a prefix that `alertMutationFailure` completes into
 * `<keyPrefix>.<suffix>`. Rejecting prefixes would flag correct code.
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
  const english: unknown = JSON.parse(fs.readFileSync(EN, 'utf8'));
  const entries = indexKeys(english);

  /** The ~163 namespaces rule 2 anchors on, read from en.json rather than listed. */
  const namespaces = new Set(Object.keys(english as Record<string, unknown>));

  const withPlurals = (key: string, accept: (candidate: string) => boolean) =>
    accept(key) || PLURAL_SUFFIXES.some(suffix => accept(`${key}${suffix}`));

  const resolvesToMessage = (key: string) =>
    withPlurals(key, candidate => entries.get(candidate) === 'message');

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
        if (!claims(key) || resolves(key)) continue;
        const line = text.slice(0, match.index).split('\n').length;
        missing.push(`${path.relative(SRC, file)}:${line} -> ${key}`);
      }
    }
    return missing;
  };

  it('keys passed to t() exist in en.json', () => {
    const CALL = /\bt\(\s*'([a-zA-Z][\w.]*\.[\w.]+)'/g;

    expect(scan(CALL, () => true, resolvesToMessage)).toEqual([]);
  });

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
