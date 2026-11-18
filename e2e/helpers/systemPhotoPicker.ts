import { element, by, waitFor, device } from 'detox';
import { delay } from './waitFor';

// The picker's header above its grid, in points.
const PICKER_HEADER = 73;

/**
 * Picks the newest photo in iOS's photo picker, opened by tapping `opener`.
 * The picker is drawn by another process: nothing in it has an id or label
 * Detox can reach, and the app learns nothing until a photo comes back. Its
 * newest photo is the first cell of a grid of thirds under the header, so that
 * point is tapped until `opener` leaves the screen; a tap before the picker is
 * up lands on the empty space under the opening screen's header. `frame` is a
 * full-width screen's, from `getAttributes()`.
 */
export async function pickNewestPhoto(
  opener: string,
  frame: { y: number; width: number },
) {
  const cell = frame.width / 3;
  const point = { x: cell / 2, y: frame.y + PICKER_HEADER + cell / 2 };
  const attempts = 5;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await delay(2000);
    await device.tap(point);
    try {
      await waitFor(element(by.id(opener)))
        .not.toExist()
        .withTimeout(3000);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
    }
  }
}
