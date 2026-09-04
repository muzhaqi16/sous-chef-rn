#!/usr/bin/env node
/**
 * Fails when a pressable control reaches a screen reader with NO name.
 *
 * ## The rule
 *
 * React Native already sets `accessible` on a `Pressable`, which collapses the
 * children into one accessibility node and reads their text as its name. So a
 * pressable wrapping a `<Text>` is named for free; `AppPressable` adds
 * `accessibilityRole="button"` so it also announces as one.
 *
 * What is left with no name at all is the ICON-ONLY control — a close ✕, a
 * remove, a chevron, a photo tile. VoiceOver and TalkBack announce it as
 * "button" and nothing else, so it cannot be found by name or told apart from
 * its neighbours. That one needs an `accessibilityLabel`.
 *
 * ## What counts as a name
 *
 * `accessibilityLabel`, `aria-label`, or a child that can put words on screen:
 * a `<Text>`, a `{t(…)}`, bare prose — or an EXPRESSION child (`{content}`,
 * `{children}`, `{renderItem(item)}`), whose text this check cannot follow but
 * whose caller usually supplies one. An `accessible={false}` control is
 * decorative by declaration and is not a finding.
 *
 * So the rule is narrow on purpose: it fires only when every child is an
 * ELEMENT and none of them is text — the icon-only shape. That makes it an
 * INVARIANT rather than a ratchet, at the cost of missing a control whose one
 * expression child resolves to an icon.
 *
 *   node scripts/check-a11y-names.mjs           # check
 *   node scripts/check-a11y-names.mjs --list    # print every finding
 *   node scripts/check-a11y-names.mjs --update  # re-baseline
 *   node scripts/check-a11y-names.mjs --self-test
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import {
  baselineFile,
  diffSets,
  filesUnder,
  fromRoot,
  parseFlags,
  refuseEmptyBaselineUpdate,
  REPO_ROOT,
  requireNonEmptyScan,
} from './lib/tooling.mjs';

const BASELINE = baselineFile(
  fromRoot('scripts/check-a11y-names.baseline.json'),
);

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /\.test\.tsx$/,
  /\.perf-test\.tsx$/,
  // The pressable primitives themselves: every prop they render comes from a
  // caller, and it is the caller this check is about.
  /^src\/components\/atoms\/AppPressable\.tsx$/,
];

/** The pressable tags this repo uses. */
const TAGS = [
  'AppPressable',
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
];

/** Walk from `<Tag` to the `>` that closes its opening element. */
function openingTag(source, start) {
  let i = start;
  let depth = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i += 1;
      while (i < source.length && source[i] !== q) {
        if (source[i] === '\\') i += 1;
        i += 1;
      }
    } else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0)
      return { text: source.slice(start, i + 1), end: i + 1 };
    i += 1;
  }
  return null;
}

/** The body between an opening tag and its matching close, nesting-aware. */
function elementBody(source, tag, bodyStart) {
  const open = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
  const close = new RegExp(`</${tag}\\s*>`, 'g');
  let depth = 1;
  let i = bodyStart;
  while (i < source.length) {
    open.lastIndex = i;
    close.lastIndex = i;
    const o = open.exec(source);
    const c = close.exec(source);
    if (!c) return source.slice(bodyStart);
    if (o && o.index < c.index) {
      depth += 1;
      i = o.index + 1;
      continue;
    }
    depth -= 1;
    if (depth === 0) return source.slice(bodyStart, c.index);
    i = c.index + 1;
  }
  return source.slice(bodyStart);
}

const NAMED = /\baccessibilityLabel\b|\baria-label\b/;
const DECORATIVE = /\baccessible=\{false\}/;
const PRESSABLE = /\bonPress\s*=/;
/**
 * Everything between a `<` and the `>` that closes it — a nested element's own
 * attributes, which hold braces of their own and are not children of this one.
 */
function stripTags(body) {
  let out = '';
  let i = 0;
  while (i < body.length) {
    if (body[i] !== '<') {
      out += body[i];
      i += 1;
      continue;
    }
    let depth = 0;
    i += 1;
    while (i < body.length) {
      const c = body[i];
      if (c === '"' || c === "'" || c === '`') {
        const q = c;
        i += 1;
        while (i < body.length && body[i] !== q) {
          if (body[i] === '\\') i += 1;
          i += 1;
        }
      } else if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
      i += 1;
    }
    i += 1;
  }
  return out;
}

/** A body that can put words on screen, or hand the job to a caller. */
const TEXT_CHILD = /<(Animated\.)?Text[\s/>]|>[^<>{}\s][^<>{}]*</;
/** `{anything}` — a child this check cannot follow, so it is treated as a name. */
const EXPRESSION_CHILD = /\{/;

export function namelessPressables(source) {
  const found = [];
  for (const tag of TAGS) {
    const re = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
    let m;
    while ((m = re.exec(source))) {
      const open = openingTag(source, m.index);
      if (!open) continue;
      if (!PRESSABLE.test(open.text)) continue;
      if (NAMED.test(open.text) || DECORATIVE.test(open.text)) continue;
      // Self-closing has no children at all, so it can only be named by a prop.
      const selfClosing = /\/>\s*$/.test(open.text);
      const body = selfClosing ? '' : elementBody(source, tag, open.end);
      if (!TEXT_CHILD.test(body) && !EXPRESSION_CHILD.test(stripTags(body)))
        found.push(tag);
    }
  }
  return found;
}

if (process.argv.includes('--self-test')) {
  const cases = [
    ['<AppPressable onPress={x}><Icon name="close" /></AppPressable>', 1],
    ['<AppPressable onPress={x}><Text>Save</Text></AppPressable>', 0],
    [
      '<AppPressable onPress={x}><Animated.Text>Save</Animated.Text></AppPressable>',
      0,
    ],
    [
      '<AppPressable onPress={x} accessibilityLabel={t("a")}><Icon /></AppPressable>',
      0,
    ],
    ['<AppPressable onPress={x} accessible={false}><Icon /></AppPressable>', 0],
    // No handler: not a control.
    ['<AppPressable><Icon /></AppPressable>', 0],
    // A self-closing pressable has no children to be named by.
    ['<Pressable onPress={x} style={s} />', 1],
    // A translated string in the body is a name.
    ['<Pressable onPress={x}>{t("labels.save")}</Pressable>', 0],
    // So is an expression child whose text this check cannot follow.
    ['<Pressable onPress={x}>{content}</Pressable>', 0],
    ['<Pressable onPress={x}>{renderItem(item)}</Pressable>', 0],
    // But a conditional wrapping only icons is still nameless.
    ['<Pressable onPress={x}><Icon /><Badge /></Pressable>', 1],
    // Nesting: both are counted when neither body has words. The inner one's
    // text WOULD name the outer too — RN collapses the children of an
    // accessible element — so a nested named control is not a finding either.
    [
      '<AppPressable onPress={a}><Icon /><AppPressable onPress={b}><Icon /></AppPressable></AppPressable>',
      2,
    ],
    [
      '<AppPressable onPress={a}><AppPressable onPress={b}><Text>x</Text></AppPressable></AppPressable>',
      0,
    ],
  ];
  let failed = false;
  for (const [source, expected] of cases) {
    const got = namelessPressables(source).length;
    if (got !== expected) {
      console.error(
        `✗ Self-test failed: expected ${expected}, got ${got} for\n    ${source}`,
      );
      failed = true;
    }
  }
  if (failed) process.exit(2);
  console.log(
    '✓ Self-test passed: an icon-only control is a finding, and a text child,\n' +
      '  a label or `accessible={false}` is not.',
  );
  process.exit(0);
}

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

const files = filesUnder(['src/**/*.tsx'], { exclude: SKIP });

requireNonEmptyScan({
  count: files.length,
  what: 'component files',
  check: 'check-a11y-names',
  hint: 'src moved, or the glob stopped matching',
  minimum: 300,
});

const findings = [];
let controls = 0;
for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  const nameless = namelessPressables(readFileSync(file, 'utf8'));
  controls += nameless.length;
  if (nameless.length) findings.push(`${rel} :: ${nameless.length}`);
}

const current = [...findings].sort();

if (flags.list) {
  for (const f of current) console.log(`  ${f}`);
  console.log(
    `\n${controls} nameless control(s) across ${current.length} files.`,
  );
  process.exit(0);
}

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: (BASELINE.exists() ? BASELINE.read().nameless ?? [] : [])
      .length,
    check: 'check-a11y-names',
  });
  BASELINE.write({ nameless: current, scanned: files.length });
  console.log(
    `Recorded ${current.length} file(s) holding ${controls} nameless control(s).`,
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-a11y-names');
const { added, removed } = diffSets(current, baseline.nameless ?? []);

if (added.length) {
  console.error(
    `\n✗ check-a11y-names: ${added.length} file(s) gained a nameless control.\n`,
  );
  for (const f of added) console.error(`    ${f}`);
  console.error(
    '\n  A screen reader announces it as "button" and nothing else. Give it an\n' +
      '  `accessibilityLabel`, put a `<Text>` in it, or say `accessible={false}`\n' +
      '  if it is decorative.\n',
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-a11y-names: ${removed.length} baselined file(s) name every control now.\n`,
  );
  for (const f of removed) console.error(`    ${f}`);
  console.error('\n  Record it: node scripts/check-a11y-names.mjs --update\n');
  process.exit(1);
}

console.log(
  `check-a11y-names: ${controls} nameless control(s) across ${current.length} ` +
    `file(s), baseline ${(baseline.nameless ?? []).length}.`,
);
