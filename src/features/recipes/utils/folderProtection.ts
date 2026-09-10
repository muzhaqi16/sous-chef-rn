// What a long-press on a folder row does. Extracted from `FolderPicker` so the
// refusal is testable at all — the decision sits inside `BottomSheetFlatList`'s
// `renderItem`, and that list is globally mocked.

// Order matters: `protected` is decided BEFORE `manage`, because that sheet is the
// entry to rename and delete, and `deleteFolder` is local-first — a protected
// folder reaching it would vanish from the cache and queue for replay.
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

  // `?? false`: an absent list only happens where the props type doesn't require
  // one, i.e. where no folder action is offered — already returned above.
  const isProtected = options.protectedFolders?.includes(folder) ?? false;
  if (isProtected) return { kind: 'protected', folder };

  return { kind: 'manage', folder };
}
