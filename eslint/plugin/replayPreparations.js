const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const REGISTRY = path.join(
  __dirname,
  '..',
  '..',
  'src',
  'features',
  'registry.data.ts',
);
const LIST = 'FEATURE_REPLAY_PREPARATIONS';

let documents;

/**
 * The generated document identifiers `REPLAY_PREPARATIONS` maps, read from the
 * feature list it is keyed from. The queue takes any of these offline whether
 * or not the caller asked.
 */
function readReplayPreparationDocuments() {
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
      node.name.text === LIST
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
    throw new Error(`No documents found in ${LIST} (${REGISTRY}).`);
  }
  return documents;
}

module.exports = { readReplayPreparationDocuments };
