import { BREAK, visit, type DocumentNode } from 'graphql';

// Every operation passes the links that ask, so each document is walked once.
const incremental = new WeakMap<DocumentNode, boolean>();

/** Whether a document asks for an answer in parts (`@defer` / `@stream`). */
export const isIncremental = (query: DocumentNode): boolean => {
  const known = incremental.get(query);
  if (known !== undefined) return known;
  let found = false;
  visit(query, {
    Directive(node) {
      if (node.name.value === 'defer' || node.name.value === 'stream') {
        found = true;
        return BREAK;
      }
      return undefined;
    },
  });
  incremental.set(query, found);
  return found;
};
