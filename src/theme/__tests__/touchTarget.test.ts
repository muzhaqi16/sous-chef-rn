import { TOUCH_TARGET_MIN, hitSlopFor } from '../touchTarget';
import { lightTheme } from '../themes';

describe('hitSlopFor', () => {
  it('adds nothing to a control already at the floor', () => {
    expect(hitSlopFor(TOUCH_TARGET_MIN + 10, TOUCH_TARGET_MIN)).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('pads only the short axis', () => {
    const slop = hitSlopFor(TOUCH_TARGET_MIN + 20, 24);

    expect(slop.left).toBe(0);
    expect(slop.top).toBe((TOUCH_TARGET_MIN - 24) / 2);
    expect(24 + (slop.top ?? 0) + (slop.bottom ?? 0)).toBe(TOUCH_TARGET_MIN);
  });

  it('pads both axes of a small control to the floor', () => {
    const slop = hitSlopFor(28, 20);

    expect(28 + (slop.left ?? 0) + (slop.right ?? 0)).toBe(TOUCH_TARGET_MIN);
    expect(20 + (slop.top ?? 0) + (slop.bottom ?? 0)).toBe(TOUCH_TARGET_MIN);
  });

  it('is the floor the theme hands to styles', () => {
    expect(lightTheme.sizes.touchTarget.min).toBe(TOUCH_TARGET_MIN);
  });
});
