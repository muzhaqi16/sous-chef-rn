/**
 * graphql-codegen plugin: every mutation the build declares, keyed by operation
 * name, for the offline queue, which sends a stored write as this build's
 * document for its operation. Each entry is a getter, so Metro's inline
 * requires load only the documents a stored queue names.
 *
 * CommonJS: codegen loads a local plugin with `require`.
 */
const path = require('node:path');
const { Kind } = require('graphql');

/** The near-operation-file output beside `location`, relative to `outDir`. */
const generatedModule = (location, outDir) => {
  const specifier = path
    .relative(outDir, path.resolve(location))
    .split(path.sep)
    .join('/')
    .replace(/\.graphql$/, '.generated');
  return specifier.startsWith('.') ? specifier : `./${specifier}`;
};

module.exports = {
  plugin(_schema, documents, _config, info) {
    const outDir = path.dirname(path.resolve(info.outputFile));
    const sorted = [...documents].sort((a, b) =>
      a.location.localeCompare(b.location),
    );
    // An operation may sit byte-identical in two files; the first one wins.
    const moduleOf = new Map();
    for (const { location, document } of sorted) {
      for (const definition of document.definitions) {
        if (
          definition.kind === Kind.OPERATION_DEFINITION &&
          definition.operation === 'mutation' &&
          definition.name &&
          !moduleOf.has(definition.name.value)
        ) {
          moduleOf.set(
            definition.name.value,
            generatedModule(location, outDir),
          );
        }
      }
    }

    const names = [...moduleOf.keys()].sort();
    const exportsOf = new Map();
    for (const name of names) {
      const module = moduleOf.get(name);
      exportsOf.set(module, [
        ...(exportsOf.get(module) ?? []),
        `${name}Document`,
      ]);
    }
    const imports = [...exportsOf.keys()]
      .sort()
      .map(
        module =>
          `import { ${exportsOf.get(module).join(', ')} } from '${module}';`,
      );

    return [
      "import type { DocumentNode } from 'graphql';",
      ...imports,
      '',
      '/** Every mutation this build declares, by operation name. */',
      'export const MUTATION_DOCUMENTS: Readonly<Record<string, () => DocumentNode>> = {',
      ...names.map(name => `  ${name}: () => ${name}Document,`),
      '};',
      '',
    ].join('\n');
  },
};
