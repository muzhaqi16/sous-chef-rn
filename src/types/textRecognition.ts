/** What on-device text recognition reads from a photo, and what it writes back. */

export interface RecognizedLine {
  text: string;
  /** The line's box as fractions of the page, origin top-left. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The text's rise per unit across, as fractions of the page; down is +. */
  slope?: number;
}

export interface RecognizedPage {
  lines: RecognizedLine[];
}

/** A page rewritten for the server to read: upright, at most 2048 px, no metadata. */
export interface PreparedPhoto {
  uri: string;
  fileSize: number;
}

/**
 * A polygon painted opaque over a photo: `points` are x, y pairs in fractions
 * of the page, grown on every side by `margin`, a fraction of its height.
 */
export interface PhotoMask {
  points: number[];
  margin: number;
}
