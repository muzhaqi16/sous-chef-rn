import fs from 'fs';
import path from 'path';

/**
 * The one shape no lint rule in this repo can see.
 *
 * `i18next/no-literal-string` checks JSX text and copy-carrying attributes; the
 * `no-restricted-syntax` sink selectors check toasts and alerts. Both look at
 * the point where a string is *written*. A module-level table —
 *
 *   const STEPS = [{ instruction: 'Swipe right to see item actions' }];
 *   …
 *   <Text>{step.instruction}</Text>
 *
 * — writes the string somewhere neither rule inspects and renders it as an
 * identifier, which is indistinguishable from any other variable. Four separate
 * sweeps missed exactly this shape, and it was found each time by grep, which
 * means it was only ever caught when someone thought to look.
 *
 * The same shape is a second bug independent of translation: a `const`
 * evaluated at import time freezes whichever language loaded first, so even a
 * localized table built this way stops following a language change. The fix for
 * both is the same — hold **key paths** and resolve with `t` at render, or make
 * the table a factory taking `t`. `moduleLevelResolvedKeys` below is the guard
 * for that half; the two are independent and a table can hit either alone.
 *
 * This is a heuristic, not a proof. It reads the source rather than the AST and
 * matches quoted values that look like English prose. It is here to make the
 * grep repeatable and to fail a PR that reintroduces the shape, not to
 * guarantee the category is empty.
 */
const SRC = path.join(__dirname, '..', '..', 'src');

/**
 * Files whose matches are a decision, not an oversight. Each entry needs a
 * reason, so adding one should be deliberate.
 */
const ALLOWED = [
  // The English IS the canonical lookup key here: SECTION_TITLE_KEYS /
  // FIELD_LABEL_KEYS / ITEM_LABEL_KEYS / OPTION_LABEL_KEYS map *by that text*,
  // and the config value is what survives a locale switch for filtering.
  // Verified: 0 of 22 key/label pairs reach the screen untranslated.
  'config/settingsConfig.ts',
  'features/profile/hooks/useConfigurableSettings.tsx',
  // Developer-facing fallback for a socket error with no message; never
  // rendered as copy.
  'apollo/links/wsLink.ts',
  // Platform font stacks — 'Helvetica' is a typeface, not a sentence.
  'components/charts/TrendLineChart.tsx',
];

/**
 * Property names that carry copy.
 *
 * An include list, mirroring the `jsx-attributes.include` list in `.eslintrc.js`
 * and for the same measured reason: scoping by property name is smaller and
 * more stable than excluding the open-ended set of properties that hold
 * enum-ish identifiers. Without it this scan also reports `operation: 'Add
 * Item'` (an `errorService.reportError` tag), `reason:` strings from biometric
 * eligibility logging, and Android channel ids — none of which are copy.
 */
const COPY_PROPS = [
  'title',
  'label',
  'placeholder',
  'message',
  'description',
  'subtitle',
  'subtext',
  'text',
  'body',
  'summary',
  'instruction',
  'emptyText',
  'emptyMessage',
  'emptyTitle',
  'emptyStateMessage',
  'emptyStateSubtext',
  'header',
  'heading',
  'caption',
  'hint',
  'helperText',
  'errorText',
  'confirmText',
  'cancelText',
  'confirmLabel',
  'cancelLabel',
  'buttonText',
  'buttonLabel',
  'actionLabel',
  'accessibilityLabel',
  'accessibilityHint',
  'modalTitle',
  'searchPlaceholder',
];

/**
 * A copy-carrying property whose value is a quoted string reading like English
 * prose. Both quote styles: the value that escaped the previous version of this
 * guard was double-quoted (prettier switches quotes for a string containing an
 * apostrophe).
 */
const PROSE = new RegExp(
  `\\b(${COPY_PROPS.join(
    '|',
  )})\\s*:\\s*(['"\`])([A-Z][a-z]+(?:[ /][A-Za-z0-9&'’,.!?-]+)+)\\2`,
);

/**
 * A copy-carrying property resolved through `t()` in the declaration itself.
 * Correct-looking and still broken: at import time this freezes the bootstrap
 * language for the session. Holding the key path and resolving at render is the
 * fix. Matches only `prop: t(…)` so deferred calls inside an accessor arrow
 * (`accessor: g => t(g.x)`) don't trip it.
 */
const RESOLVED_KEY = new RegExp(`\\b(${COPY_PROPS.join('|')})\\s*:\\s*t\\(`);

/** A copy-carrying property whose value prettier pushed onto the next line. */
const DANGLING_PROP = new RegExp(`\\b(${COPY_PROPS.join('|')})\\s*:\\s*$`);

/** `const NAME = ` / `export const NAME: T = ` at column 0. */
const MODULE_CONST = /^(?:export\s+)?const\s+[A-Za-z_][A-Za-z0-9_]*\b/;

/** A function boundary. Once one is crossed the remaining lines are a deferred
 *  body, so a `t()` there resolves at call time and is correct. Tracked across
 *  the whole declaration, not just its first line — a component written as
 *  `export const Screen: React.FC<P> = ({` puts its `=>` several lines down. */
const FUNCTION_BOUNDARY = /\bfunction\b|=>/;

/**
 * Only a module-scope `t` can be called at module level; a component's
 * `useTranslation()` binding doesn't exist there. Requiring this import is what
 * separates the real bug from the ~30 `title: t(…)` lines that sit inside
 * component bodies.
 */
const IMPORTS_MODULE_T = /from\s+'#\/?i18n\/t'/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        ['__tests__', '__mocks__', 'generated', 'locales'].includes(entry.name)
      )
        continue;
      sourceFiles(full, out);
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name)
    ) {
      // `.ts` as well as `.tsx`: the AddItemSheet sheet configs that shipped
      // untranslated copy to the shopping-list sheet were plain `.ts`, so a
      // `.tsx`-only walk never opened them.
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan each module-level `const` declaration, bounded by bracket depth rather
 * than a fixed line window — the config objects that escaped the previous
 * version put their copy ~50 lines in, well past the old 12-line lookahead.
 */
function scanDeclarations(
  file: string,
  match: (window: string) => RegExpExecArray | null,
  stopAtFunctionBoundary: boolean,
): string[] {
  const source = fs.readFileSync(file, 'utf8');
  if (stopAtFunctionBoundary && !IMPORTS_MODULE_T.test(source)) return [];
  const lines = source.split('\n');
  const hits: string[] = [];

  lines.forEach((line, index) => {
    if (!MODULE_CONST.test(line)) return;

    let depth = 0;
    let opened = false;
    for (let i = index; i < lines.length; i++) {
      if (stopAtFunctionBoundary && FUNCTION_BOUNDARY.test(lines[i])) break;
      for (const char of lines[i]) {
        if (char === '{' || char === '[') {
          depth++;
          opened = true;
        } else if (char === '}' || char === ']') depth--;
      }
      // Match the line on its own first, and only join it with the next when
      // the property name is left dangling — prettier wraps a long value onto
      // the following line, which is how one offender escaped the previous
      // version. Joining unconditionally would report every wrapped hit twice.
      const found =
        match(lines[i]) ??
        (DANGLING_PROP.test(lines[i])
          ? match(`${lines[i]} ${(lines[i + 1] ?? '').trim()}`)
          : null);
      if (found) {
        hits.push(`${file.slice(SRC.length + 1)}:${i + 1}  ${found[1]}`);
      }
      if (opened && depth <= 0) break;
      if (!opened && i > index) break;
    }
  });

  return hits;
}

function offenders(
  match: (window: string) => RegExpExecArray | null,
  stopAtFunctionBoundary = false,
): string[] {
  return sourceFiles(SRC)
    .filter(file => !ALLOWED.some(allowed => file.endsWith(allowed)))
    .flatMap(file => scanDeclarations(file, match, stopAtFunctionBoundary));
}

describe('module-level tables of user-visible copy', () => {
  it('are not reintroduced — hold key paths or take t, never resolved strings', () => {
    expect(offenders(window => PROSE.exec(window))).toEqual([]);
  });

  it('do not resolve keys at import time, which freezes the bootstrap language', () => {
    expect(offenders(window => RESOLVED_KEY.exec(window), true)).toEqual([]);
  });
});
