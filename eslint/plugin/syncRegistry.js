const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const REGISTRY = path.join(
  __dirname,
  '..',
  '..',
  'src',
  'apollo',
  'offlineQueue',
  'syncRegistry.ts',
);

let documents;

/**
 * The generated document identifiers `SYNC_REGISTRY` maps, read from its own
 * source. The queue takes any of these offline whether or not the caller asked.
 */
function readSyncRegistryDocuments() {
  if (documents) return documents;
  documents = new Set();
  const source = ts.createSourceFile(
    REGISTRY,
    fs.readFileSync(REGISTRY, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const visit = node => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'SYNC_REGISTRY'
    ) {
      node.forEachChild(function collect(child) {
        if (
          ts.isArrayLiteralExpression(child) &&
          child.elements.length &&
          ts.isArrayLiteralExpression(child.elements[0])
        ) {
          for (const pair of child.elements) {
            const [document] = pair.elements;
            if (document && ts.isIdentifier(document)) {
              documents.add(document.text);
            }
          }
        }
        child.forEachChild(collect);
      });
    }
    node.forEachChild(visit);
  };
  visit(source);

  // Fail closed: an empty set would make the rule pass on every call site.
  if (documents.size === 0) {
    throw new Error(`No documents found in SYNC_REGISTRY (${REGISTRY}).`);
  }
  return documents;
}

module.exports = { readSyncRegistryDocuments };
