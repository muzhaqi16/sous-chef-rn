import { mergedLocale } from '#/test-utils/mergedLocales';
import * as ts from 'typescript';
import {
  lineOf,
  nodesOf,
  parseSource,
  productionSources,
} from '#/test-utils/sourceAst';

/**
 * Every i18n key a source file names must exist in en.json.
 *
 * A literal passed to `t(...)` is checked by the compiler: `t` takes a
 * `TranslationKey` (`src/i18n/i18next.d.ts`). What the types cannot see is a key
 * STORED in a plain-string slot for a consumer to resolve later, or a prefix a
 * consumer completes at runtime. So this matches every literal whose first
 * segment is a real en.json namespace and requires it to name a message or a
 * subtree. The literals come from the parsed tree, so comments are not code.
 */

/** i18next plural/context suffixes — `t('x', {count})` resolves x_one / x_other. */
const PLURAL_SUFFIXES = ['_one', '_other', '_zero', '_two', '_few', '_many'];

/**
 * A filename can open with a namespace: `profile.jpg` starts with `profile`.
 * A key is matched on its first segment alone, so assets are excluded by suffix.
 * No en.json key ends in any of these segments, so nothing real is hidden.
 */
const ASSET_FILE = /\.(png|jpg|jpeg|gif|webp|svg|heic|mp3|mp4|json|txt|pdf)$/i;

/** Every static string literal in a file, with its line; comments are not code. */
const literalsIn = (file: string, text?: string) =>
  nodesOf(parseSource(file, text))
    .filter(
      (node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
        ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node),
    )
    .map(node => ({ text: node.text, line: lineOf(node) }));

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

  /** `file:line -> key` for every literal the rule claims and cannot resolve. */
  const scan = (
    files: string[],
    claims: (key: string) => boolean,
    resolves: (key: string) => boolean,
    text?: string,
  ): string[] =>
    files.flatMap(file =>
      literalsIn(file, text)
        .filter(literal => claims(literal.text) && !resolves(literal.text))
        .map(literal => `${file}:${literal.line} -> ${literal.text}`),
    );

  const startsWithNamespace = (key: string) => {
    const boundary = key.indexOf('.');
    return (
      boundary > 0 &&
      namespaces.has(key.slice(0, boundary)) &&
      !ASSET_FILE.test(key)
    );
  };

  it('catches a missing key in any static literal, backticks included', () => {
    const planted = 'const key = `labels.noSuchLabelAnywhere`;';

    expect(
      scan(['planted.ts'], startsWithNamespace, resolvesToNode, planted),
    ).toEqual(['planted.ts:1 -> labels.noSuchLabelAnywhere']);
  });

  it('keys held outside a t() call exist in en.json', () => {
    expect(
      scan(productionSources(), startsWithNamespace, resolvesToNode),
    ).toEqual([]);
  });
});
