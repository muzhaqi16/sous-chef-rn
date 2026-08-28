/**
 * What a long-press on a folder row should do.
 *
 * Extracted from `FolderPicker` so the refusal is testable. The decision lives
 * inside `BottomSheetFlatList`'s `renderItem`, and that list is globally mocked
 * in tests, so no test rendering the component can reach it — which is how a
 * picker that protected nothing shipped: the wiring was wrong at one call site
 * and nothing could observe the resulting behaviour.
 *
 * The order matters. `protected` must be decided BEFORE `manage`, because the
 * manage sheet is the entry point to rename and delete, and `deleteFolder` is
 * local-first: it removes the folder from the cache before the server answers,
 * so a protected folder that reached that sheet would disappear from the user's
 * view and queue for replay.
 */
export type FolderLongPressOutcome =
  /** No rename/delete handlers supplied — long-press does nothing. */
  | { kind: 'ignored' }
  /** Protected: refuse, and say why. */
  | { kind: 'protected'; folder: string }
  /** Open the manage sheet for this folder. */
  | { kind: 'manage'; folder: string };

export function resolveFolderLongPress(
  folder: string,
  options: {
    hasFolderActions: boolean;
    protectedFolders: string[] | undefined;
  },
): FolderLongPressOutcome {
  if (!options.hasFolderActions) return { kind: 'ignored' };

  // `?? false` rather than `?? true`: an absent list can only occur where the
  // props type does not require one, which is exactly where no folder action is
  // offered — and that case already returned above.
  const isProtected = options.protectedFolders?.includes(folder) ?? false;
  if (isProtected) return { kind: 'protected', folder };

  return { kind: 'manage', folder };
}
