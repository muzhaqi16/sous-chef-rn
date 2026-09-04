import { fonts } from './typography';

/**
 * The nine type roles. Text is set by naming what it IS, so two screens cannot
 * pick different sizes for the same kind of text without saying so. A role
 * carries size, weight, leading and tracking together — leading is the ratio
 * the audit found applied five different ways, resolved here once per role.
 */
export interface TypeRole {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  lineHeight: number;
  letterSpacing?: number;
}

const role = (
  fontSize: number,
  fontWeight: TypeRole['fontWeight'],
  leading: number,
  letterSpacing?: number,
): TypeRole => ({
  fontSize,
  fontWeight,
  lineHeight: Math.round(fontSize * leading),
  ...(letterSpacing === undefined ? {} : { letterSpacing }),
});

const { size, weight, letterSpacing } = fonts;

export const type = {
  /** A hero figure or a one-word screen statement. */
  display: role(size['3xl'], weight.bold, 1.2, letterSpacing.tight),
  /** A screen's own title, in the body rather than a header bar. */
  title: role(size['2xl'], weight.bold, 1.2, letterSpacing.tight),
  /** A block heading that ranks above a section heading. */
  subheading: role(size.xl, weight.semibold, 1.25, letterSpacing.tight),
  /** A section heading — the most common heading in the tree. */
  heading: role(size.lg, weight.semibold, 1.3),
  /** Running text. */
  body: role(size.md, weight.regular, 1.5),
  /** Running text carrying the emphasis of its row. */
  bodyStrong: role(size.md, weight.semibold, 1.5),
  /** Secondary or supporting copy, and a row's subtitle. */
  caption: role(size.sm, weight.regular, 1.4),
  /** The name of a control or a field — a caption that labels something. */
  label: role(size.sm, weight.medium, 1.4),
  /** Validation and refusal copy. Its colour comes from the `error` tone. */
  error: role(size.sm, weight.regular, 1.4),
};

export type TypeRoleName = keyof typeof type;

/**
 * The combined font-scale ceiling. The OS text size and the app's own
 * 0.9–1.3 preference multiply, so the cap is applied once, on the product,
 * in the `Text` atom — not per element.
 */
export const MAX_FONT_SCALE = 1.6;
