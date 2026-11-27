import micromatch from 'micromatch';
import { productionSources } from '#/test-utils/sourceAst';

/**
 * Every source file belongs to a boundary element. A file in no element is
 * unknown to `boundaries/dependencies`, so no policy holds it: a new top-level
 * folder would import any feature's internals unseen.
 */

const { BOUNDARY_ELEMENTS } = jest.requireActual<{
  BOUNDARY_ELEMENTS: Array<{ type: string; pattern: string }>;
}>('../../eslint/boundaries.js');

const classify = (file: string): string | undefined =>
  BOUNDARY_ELEMENTS.find(element => micromatch.isMatch(file, element.pattern))
    ?.type;

describe('boundary elements', () => {
  it('leave a file in a new folder unclassified', () => {
    expect(classify('src/newFolder/thing.ts')).toBeUndefined();
    expect(classify('src/features/pantry/cache/feedRows.ts')).toBe(
      'feature-private',
    );
  });

  it('classify every production source', () => {
    const unclassified = productionSources().filter(file => !classify(file));

    expect(unclassified).toEqual([]);
  });
});
