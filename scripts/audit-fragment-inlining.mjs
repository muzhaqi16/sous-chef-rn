#!/usr/bin/env node
/**
 * Counts inline field-selection patterns across src/**\/*.graphql to track
 * progress on the "per-component fragments + useFragment" migration.
 *
 * The previous refactor eliminated all `@unmask` directives by inlining the
 * spread sub-fragments at every use site. That left ~95 duplicated inline
 * selections (e.g. `unit { id name symbol }` appears 23 times). The migration
 * to per-component fragments + `useFragment` replaces those with co-located
 * narrow fragments and `useFragment` materialization.
 *
 * This script:
 *   - Reads every `.graphql` file under `src/`
 *   - Normalizes whitespace and counts occurrences of known inline patterns
 *   - Compares against the baseline in `scripts/audit-fragment-inlining.baseline.json`
 *   - Exits non-zero if any count *increased* (a regression)
 *   - Exits zero if counts stayed the same or decreased (or with `--update`
 *     to write a new baseline reflecting the current state)
 *
 * Usage:
 *   node scripts/audit-fragment-inlining.mjs           # check
 *   node scripts/audit-fragment-inlining.mjs --update  # rewrite baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const BASELINE = join(__dirname, 'audit-fragment-inlining.baseline.json');

/**
 * Each pattern is a regex run against whitespace-normalized GraphQL text.
 * A "normalized" file has `\s+` collapsed to single spaces and the selection
 * blocks compacted to `{ field field … }` form.
 */
const PATTERNS = [
  {
    name: 'unit_idNameSymbol',
    description: 'unit { id name symbol } — UnitBasic-equivalent (3 fields)',
    // Matches `unit { id name symbol }` or any single-word unit field name
    // (netWeightUnit, contentUnit, displayUnit, usageUnit, fromUnit, toUnit,
    // perUnitNetWeightUnit, remainingWeightUnit) selecting exactly the 3
    // UnitBasic fields in any order.
    regex:
      /(?:unit|netWeightUnit|displayUnit|contentUnit|fromUnit|toUnit|usageUnit|perUnitNetWeightUnit|remainingWeightUnit|defaultConsumeUnit)\s*\{\s*(?:id|name|symbol)(?:\s+(?:id|name|symbol)){2}\s*\}/g,
  },
  {
    name: 'unit_idSymbol',
    description: 'unit { id symbol } — 2-field variant',
    regex:
      /(?:unit|displayUnit|contentUnit|usageUnit)\s*\{\s*(?:id|symbol)\s+(?:id|symbol)\s*\}/g,
  },
  {
    name: 'unit_full11',
    description:
      'unit { id name symbol type isMetric … autoConvertThreshold } — UnitFull-equivalent (11 fields)',
    regex:
      /(?:unit|defaultConsumeUnit|fromUnit|toUnit)\s*\{\s*(?:id|name|symbol|type|isMetric|baseUnitId|conversionFactor|isCommon|displayAsFraction|minPrecision|autoConvertThreshold)(?:\s+(?:id|name|symbol|type|isMetric|baseUnitId|conversionFactor|isCommon|displayAsFraction|minPrecision|autoConvertThreshold)){10}\s*\}/g,
  },
  {
    name: 'profile_basic',
    description:
      'profile { id displayName avatar } — UserProfileFields-equivalent',
    regex:
      /profile\s*\{\s*(?:id|displayName|avatar)(?:\s+(?:id|displayName|avatar)){2}\s*\}/g,
  },
  {
    name: 'profile_full5',
    description:
      'profile { id displayName avatar firstName lastName } — UserProfileFull-equivalent',
    regex:
      /profile\s*\{\s*(?:id|displayName|avatar|firstName|lastName)(?:\s+(?:id|displayName|avatar|firstName|lastName)){4}\s*\}/g,
  },
  {
    name: 'brand_idName',
    description: 'brand { id name } — BrandFields-equivalent',
    regex: /brand\s*\{\s*(?:id|name)\s+(?:id|name)\s*\}/g,
  },
  {
    name: 'store_idName',
    description: 'store { id name } — StoreFields-equivalent',
    regex: /store\s*\{\s*(?:id|name)\s+(?:id|name)\s*\}/g,
  },
  {
    name: 'images_urlKind',
    description: 'images { url kind } — ImageRef inline',
    regex: /images\s*\{\s*(?:url|kind)\s+(?:url|kind)\s*\}/g,
  },
  {
    name: 'home_withMembership',
    description:
      'home { id name myMembership { id role } } — HomeWithMembership inline',
    regex: /home\s*\{\s*id\s+name\s+myMembership\s*\{\s*id\s+role\s*\}\s*\}/g,
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (entry.endsWith('.graphql')) out.push(full);
  }
  return out;
}

function normalize(text) {
  // Collapse all whitespace to single spaces so multi-line and single-line
  // selection blocks count identically.
  return text.replace(/\s+/g, ' ');
}

function countPatterns(files) {
  const counts = Object.create(null);
  const byFile = Object.create(null);
  for (const file of files) {
    const text = normalize(readFileSync(file, 'utf8'));
    const rel = relative(ROOT, file);
    for (const { name, regex } of PATTERNS) {
      regex.lastIndex = 0;
      const matches = text.match(regex);
      const n = matches ? matches.length : 0;
      if (n > 0) {
        counts[name] = (counts[name] || 0) + n;
        byFile[rel] ??= {};
        byFile[rel][name] = n;
      }
    }
  }
  return { counts, byFile };
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'));
  } catch {
    return null;
  }
}

function writeBaseline(data) {
  writeFileSync(BASELINE, JSON.stringify(data, null, 2) + '\n');
}

function main() {
  const args = new Set(process.argv.slice(2));
  const update = args.has('--update');

  const files = walk(SRC);
  const { counts, byFile } = countPatterns(files);

  if (update) {
    writeBaseline({
      _description:
        'Per-pattern counts of inline field selections across src/**/*.graphql. ' +
        'The audit-fragment-inlining.mjs script fails if any count regresses.',
      counts,
    });
    console.log('Updated baseline:');
    for (const { name, description } of PATTERNS) {
      const n = counts[name] || 0;
      console.log(`  ${name}: ${n}  — ${description}`);
    }
    return;
  }

  const baseline = loadBaseline();
  if (!baseline) {
    console.error(
      `No baseline found at ${BASELINE}. Run with --update to create one.`,
    );
    process.exit(1);
  }

  let regressions = 0;
  console.log('Inline-fragment audit:');
  for (const { name, description } of PATTERNS) {
    const current = counts[name] || 0;
    const expected = baseline.counts?.[name] ?? 0;
    const diff = current - expected;
    const status =
      diff > 0 ? '❌ REGRESSED' : diff < 0 ? '✅ improved' : '·  same';
    console.log(
      `  ${status}  ${name}: ${current} (baseline ${expected}, Δ${
        diff >= 0 ? '+' : ''
      }${diff})  — ${description}`,
    );
    if (diff > 0) {
      regressions++;
      // Identify which files contain the new occurrences.
      for (const [file, fileCounts] of Object.entries(byFile)) {
        if ((fileCounts[name] || 0) > 0) {
          console.log(`      ↳ ${file}: ${fileCounts[name]}`);
        }
      }
    }
  }

  if (regressions > 0) {
    console.error(
      `\n${regressions} pattern(s) regressed. Either undo the inline duplication or, ` +
        'if intentional, run `npm run audit:fragments -- --update` to accept the new baseline.',
    );
    process.exit(1);
  }
  console.log('\nAll inline-fragment counts are at or below baseline.');
}

main();
