import { client } from '#/apollo/client';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { storage } from '#/storage/mmkv';
import { useStore } from '#store';
import { executeMutation } from '#/utils/compilerSafeWrappers';

/**
 * Records that the user has been through the guided tutorials at the *account*
 * level by turning the server `showTutorials` flag off.
 *
 * The app has no per-tutorial server field — `UserSettings.showTutorials` is the
 * only tutorial signal that syncs across devices (it's mirrored into MMKV
 * `user_show_tutorials` and read by `useShowTutorials`). Finishing or skipping a
 * guided sequence flips it off so the coach marks don't replay when the same
 * account logs in on a new device. Turning "Show Tutorials" back on re-enables
 * them, and only not-yet-seen tutorials appear (local hint flags are untouched).
 *
 * A plain function (not a hook) so completion handlers can call it without
 * requiring an Apollo provider in the React tree at render time — the mutation
 * fires imperatively through the shared client only when this is invoked.
 */
export function markTutorialsSeen(): void {
  // Local mirror — synchronous so MMKV consumers are consistent immediately.
  storage.set('user_show_tutorials', false);
  // Already-mounted tutorial hooks snapshot MMKV at mount and only re-read on
  // the reset signal — bump it so they pick up the change right away.
  useStore.getState().bumpTutorialResetGeneration();

  // Server — persist so other devices honor it. Fire-and-forget: if the write
  // can't reach the server the local MMKV flag still prevents replay on this
  // device, and the value re-syncs on the next settings update or login.
  void executeMutation(
    () =>
      client.mutate({
        mutation: UpdateUserPreferencesDocument,
        variables: { input: { ui: { showTutorials: false } } },
      }),
    'Failed to persist tutorial completion',
  );
}
