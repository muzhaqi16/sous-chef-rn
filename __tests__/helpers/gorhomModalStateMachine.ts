/**
 * A stateful fake `BottomSheetModal` ref that models the part of
 * @gorhom/bottom-sheet 5.2.14's `MODAL_STATUS` machine that plain `jest.fn()`
 * mocks can't see — and that caused a whole class of lifecycle bugs:
 *
 * - `present()` **no-ops while DISMISSING** (gorhom's `handlePortalRender`
 *   skips DISMISSING modals), so a sheet wedged into DISMISSING never reopens.
 * - `dismiss()` on an **already-closed** modal flips it to DISMISSING (the
 *   wedge); `dismiss()` on an **open** modal closes cleanly and resets to
 *   INITIAL (so it can reopen).
 * - `minimize()` hides without dismissing (status MINIMIZED, stays mounted) and
 *   `restore()` brings it back — used for navigation hide/show.
 *
 * Stateless `jest.fn()`s have no status, so a redundant `dismiss()` looks
 * harmless and a no-oped `present()` still "registers a call." This fake makes
 * those failures observable via `onScreen` / `status`. Reuse it across sheet
 * tests with the invariant: *after ANY close path, a subsequent present()
 * reopens.*
 */
export type FakeModalStatus =
  | 'INITIAL'
  | 'PRESENTED'
  | 'DISMISSING'
  | 'MINIMIZED';

export interface FakeBottomSheetModal {
  present: jest.Mock<void, []>;
  dismiss: jest.Mock<void, []>;
  minimize: jest.Mock<void, []>;
  restore: jest.Mock<void, []>;
  /** Simulate the user closing the sheet (swipe / backdrop tap): gorhom closes
   *  internally WITHOUT calling our `dismiss()`, resets, then fires onDismiss. */
  selfClose: () => void;
  readonly onScreen: boolean;
  readonly status: FakeModalStatus;
}

export function createFakeBottomSheetModal(): FakeBottomSheetModal {
  let status: FakeModalStatus = 'INITIAL';
  let onScreen = false;

  return {
    present: jest.fn(() => {
      if (status === 'DISMISSING') return; // gorhom skips DISMISSING modals
      status = 'PRESENTED';
      onScreen = true;
    }),
    dismiss: jest.fn(() => {
      if (onScreen) {
        onScreen = false;
        status = 'INITIAL'; // legitimate close of an open modal resets cleanly
      } else {
        status = 'DISMISSING'; // redundant dismiss on a closed modal → wedge
      }
    }),
    minimize: jest.fn(() => {
      if (status === 'MINIMIZED') return;
      onScreen = false;
      status = 'MINIMIZED'; // hidden but still mounted; no onDismiss
    }),
    restore: jest.fn(() => {
      if (status !== 'MINIMIZED') return;
      onScreen = true;
      status = 'PRESENTED';
    }),
    selfClose: () => {
      onScreen = false;
      status = 'INITIAL';
    },
    get onScreen() {
      return onScreen;
    },
    get status() {
      return status;
    },
  };
}
