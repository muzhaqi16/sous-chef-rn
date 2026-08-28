import { resolveFolderLongPress } from '../folderProtection';

/**
 * The refusal path, tested where it can actually be reached.
 *
 * Rendering `FolderPicker` cannot exercise this: the long-press handler lives
 * inside `BottomSheetFlatList`'s `renderItem`, and that list is globally mocked.
 * A picker that protected nothing therefore shipped with a green suite.
 */
describe('resolveFolderLongPress', () => {
  const withActions = {
    hasFolderActions: true,
    protectedFolders: ['Favorites'],
  };

  it('refuses a protected folder instead of opening the manage sheet', () => {
    expect(resolveFolderLongPress('Favorites', withActions)).toEqual({
      kind: 'protected',
      folder: 'Favorites',
    });
  });

  it('opens the manage sheet for an unprotected folder', () => {
    expect(resolveFolderLongPress('Weeknight', withActions)).toEqual({
      kind: 'manage',
      folder: 'Weeknight',
    });
  });

  it('decides protection BEFORE manage, so a local-first delete cannot start', () => {
    // `deleteFolder` removes the folder from the cache before the server
    // answers. If a protected folder reached the manage sheet, it would vanish
    // from the user's view and queue for replay — so the order is the guarantee.
    const outcome = resolveFolderLongPress('Favorites', withActions);
    expect(outcome.kind).not.toBe('manage');
  });

  it('ignores the long-press entirely when no folder actions are offered', () => {
    expect(
      resolveFolderLongPress('Favorites', {
        hasFolderActions: false,
        protectedFolders: ['Favorites'],
      }),
    ).toEqual({ kind: 'ignored' });
  });

  it('protects nothing when the caller declares an empty list', () => {
    expect(
      resolveFolderLongPress('Favorites', {
        hasFolderActions: true,
        protectedFolders: [],
      }),
    ).toEqual({ kind: 'manage', folder: 'Favorites' });
  });

  it('does not protect a folder whose name merely resembles a protected one', () => {
    expect(resolveFolderLongPress('Favorites 2', withActions)).toEqual({
      kind: 'manage',
      folder: 'Favorites 2',
    });
  });

  it('falls back to unprotected only where the type allows no list', () => {
    // Reachable only in the no-actions variant, which returns `ignored` first.
    expect(
      resolveFolderLongPress('Favorites', {
        hasFolderActions: true,
        protectedFolders: undefined,
      }),
    ).toEqual({ kind: 'manage', folder: 'Favorites' });
  });
});
