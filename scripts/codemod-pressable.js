#!/usr/bin/env node
/**
 * One-shot codemod (Unistyles theme propagation): route `Pressable` imports
 * from `react-native-gesture-handler` through the project-local Unistyles
 * wrapper at `#components/atoms/themedComponents`.
 *
 * Background: RNGH's Pressable bypasses the standard RN style pipeline that
 * Unistyles' Babel plugin hooks into (unistyles#1109), so its child View does
 * not repaint on theme change until a remount. Wrapping with `withUnistyles`
 * forces a re-render on every theme tick so the View receives fresh proxies.
 *
 * Handles single-line and multi-line named imports, leaves the existing
 * import in place when other named exports are also imported, and skips
 * the wrapper file itself.
 *
 * Usage: node scripts/codemod-pressable.js
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(PROJECT_ROOT, 'src');
const NEW_SOURCE = '#components/atoms/themedComponents';
const TARGET_FILE = path.join(SRC, 'components/atoms/themedComponents.tsx');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const importRe =
  /import\s*(type\s+)?\{([^}]*)\}\s*from\s*(['"])react-native-gesture-handler\3\s*;?/g;

let modified = 0;
let totalReplacements = 0;
const files = walk(SRC);

for (const file of files) {
  if (path.resolve(file) === TARGET_FILE) continue;
  const src = fs.readFileSync(file, 'utf8');
  let changed = false;
  let replacements = 0;

  const newSrc = src.replace(importRe, (full, typeKw, body, quote) => {
    const names = body
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const idx = names.indexOf('Pressable');
    if (idx === -1) return full;

    names.splice(idx, 1);
    changed = true;
    replacements++;

    const remaining =
      names.length > 0
        ? `import ${typeKw ?? ''}{ ${names.join(
            ', ',
          )} } from ${quote}react-native-gesture-handler${quote};`
        : '';
    const added = `import { Pressable } from ${quote}${NEW_SOURCE}${quote};`;

    return remaining ? `${remaining}\n${added}` : added;
  });

  if (changed) {
    fs.writeFileSync(file, newSrc, 'utf8');
    modified++;
    totalReplacements += replacements;
  }
}

console.log(
  `Modified ${modified} files (${totalReplacements} import statements rewritten)`,
);
