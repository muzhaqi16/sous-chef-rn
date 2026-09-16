import * as fs from 'node:fs';
import * as path from 'node:path';
import { Kind, parse, type OperationDefinitionNode } from 'graphql';

const ROOT = path.join(__dirname, '..', '..');
export const SRC = path.join(ROOT, 'src');

export function walk(dir: string, test: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...walk(full, test));
    } else if (test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every authored mutation, by operation name. */
export function authoredMutations(): Map<string, OperationDefinitionNode> {
  const found = new Map<string, OperationDefinitionNode>();
  for (const file of walk(SRC, name => name.endsWith('.graphql'))) {
    if (file.includes(path.join('generated', 'schema.graphql'))) continue;
    let doc;
    try {
      doc = parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    for (const def of doc.definitions) {
      if (
        def.kind === Kind.OPERATION_DEFINITION &&
        def.operation === 'mutation' &&
        def.name
      ) {
        found.set(def.name.value, def);
      }
    }
  }
  return found;
}

/**
 * The operation names reachable from a file that opts into `localFirst`.
 * Over-collects (a file's queries come along too) and is then narrowed to the
 * authored mutations — a false positive here would only make a gate stricter.
 */
export function localFirstOperationNames(): Set<string> {
  const names = new Set<string>();
  for (const file of walk(
    SRC,
    name => name.endsWith('.ts') || name.endsWith('.tsx'),
  )) {
    const source = fs.readFileSync(file, 'utf8');
    if (!/localFirst:\s*true/.test(source)) continue;
    for (const match of source.matchAll(/\b([A-Z][A-Za-z0-9_]*)Document\b/g)) {
      names.add(match[1]!);
    }
    // `useXMutation()` codegen hooks name the operation the same way.
    for (const match of source.matchAll(
      /\buse([A-Z][A-Za-z0-9_]*)Mutation\b/g,
    )) {
      names.add(match[1]!);
    }
  }
  return names;
}
