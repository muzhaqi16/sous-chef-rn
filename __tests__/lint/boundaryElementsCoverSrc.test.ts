import path from 'path';
import {
  Elements,
  type ElementDescriptors,
  type FileDescriptors,
} from '@boundaries/elements';
import { productionSources } from '#/test-utils/sourceAst';

/**
 * Every source file is held by a boundary: an element, or the registry file
 * category beside the features. A file in neither is unknown to
 * `boundaries/dependencies`, so no policy holds it: a new top-level folder
 * would import any feature's internals unseen.
 *
 * Classified by the plugin's own matcher: elements match folders only, so a
 * glob test here would pass a file the plugin leaves unknown.
 */

const ROOT = path.join(__dirname, '..', '..');

const { BOUNDARY_ELEMENTS, BOUNDARY_FILES } = jest.requireActual<{
  BOUNDARY_ELEMENTS: ElementDescriptors;
  BOUNDARY_FILES: FileDescriptors;
}>('../../eslint/boundaries.js');

const matcher = new Elements({ rootPath: ROOT }).getMatcher({
  elements: BOUNDARY_ELEMENTS,
  files: BOUNDARY_FILES,
});

const isHeld = (file: string): boolean => {
  const absolute = path.join(ROOT, file);
  return (
    !matcher.describeElement(absolute).isUnknown ||
    (matcher.describeFile(absolute).categories ?? []).includes('registry')
  );
};

describe('boundary elements', () => {
  it('hold a feature internal, a registry, and not a new folder', () => {
    expect(isHeld('src/features/pantry/cache/feedRows.ts')).toBe(true);
    expect(isHeld('src/features/registry.static.ts')).toBe(true);
    expect(isHeld('src/newFolder/thing.ts')).toBe(false);
  });

  it('hold every production source', () => {
    expect(productionSources().filter(file => !isHeld(file))).toEqual([]);
  });
});
