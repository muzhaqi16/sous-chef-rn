import { Kind, visit, type DocumentNode, type SelectionSetNode } from 'graphql';
import { MUTATION_DOCUMENTS } from '#/graphql/generated/mutationDocuments.generated';

/**
 * The queue settles a refusal from its `disposition`, so a code newer than the
 * build still settles. A write that does not select it reads as refused: a row
 * the server would have retried, or one that landed, goes on the changes not
 * saved list.
 */
const selects = (selectionSet: SelectionSetNode, name: string): boolean =>
  selectionSet.selections.some(
    selection => selection.kind === Kind.FIELD && selection.name.value === name,
  );

function refusalsWithoutDisposition(document: DocumentNode): string[] {
  const missing: string[] = [];
  visit(document, {
    InlineFragment: node => {
      if (
        node.typeCondition?.name.value === 'Error' &&
        !selects(node.selectionSet, 'disposition')
      ) {
        missing.push('... on Error');
      }
    },
    Field: node => {
      if (
        node.name.value === 'failure' &&
        node.selectionSet &&
        !selects(node.selectionSet, 'disposition')
      ) {
        missing.push('failure');
      }
    },
  });
  return missing;
}

describe('a write states what to do with its refusal', () => {
  it.each(Object.entries(MUTATION_DOCUMENTS))('%s', (_name, document) => {
    expect(refusalsWithoutDisposition(document())).toEqual([]);
  });
});
