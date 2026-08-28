import { renderHook } from '@testing-library/react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useCollapsibleScroll } from '../useCollapsibleScroll';

/** Offsets used below sit either side of the hook's own gates (reveal 72,
 *  collapse 120, travel 48) — they are the contract these tests pin. */
const scrollTo = (y: number) =>
  ({
    nativeEvent: { contentOffset: { y } },
  } as NativeSyntheticEvent<NativeScrollEvent>);

const endDragAt = (velocity: number) =>
  ({
    nativeEvent: { velocity: { y: velocity } },
  } as NativeSyntheticEvent<NativeScrollEvent>);

const setup = () => {
  const { result } = renderHook(() => useCollapsibleScroll());
  return result;
};

describe('useCollapsibleScroll', () => {
  it('hides the bar once a downward drag is sustained past the collapse distance', () => {
    const r = setup();
    r.current.scrollBeginDragHandler();

    r.current.scrollHandler(scrollTo(130));

    expect(r.current.isScrolledDown.get()).toBe(true);
  });

  it('leaves the bar alone until the drag has travelled far enough', () => {
    const r = setup();
    // Park the list well past the collapse distance without a finger, so the
    // drag below starts from 200 rather than from the top.
    r.current.scrollHandler(scrollTo(200));
    r.current.scrollBeginDragHandler();

    // Downward and past the collapse distance, but only 30px of travel — under
    // the 48px the bar requires before it follows a direction.
    r.current.scrollHandler(scrollTo(230));

    expect(r.current.isScrolledDown.get()).toBe(false);
  });

  it('does not reveal the bar on an unsustained reversal', () => {
    const r = setup();
    r.current.scrollBeginDragHandler();
    r.current.scrollHandler(scrollTo(130));
    r.current.scrollHandler(scrollTo(200));
    expect(r.current.isScrolledDown.get()).toBe(true);

    // A 40px correction — the size a finger makes constantly mid-scroll. Reading
    // direction per event flipped the bar here, which is what read as flicker.
    r.current.scrollHandler(scrollTo(160));

    expect(r.current.isScrolledDown.get()).toBe(true);
  });

  it('holds through repeated jitter that never sustains a direction', () => {
    const r = setup();
    r.current.scrollBeginDragHandler();
    r.current.scrollHandler(scrollTo(300));
    expect(r.current.isScrolledDown.get()).toBe(true);

    for (const y of [280, 310, 285, 315, 290, 320]) {
      r.current.scrollHandler(scrollTo(y));
      expect(r.current.isScrolledDown.get()).toBe(true);
    }
  });

  it('reveals the bar once an upward drag is sustained', () => {
    const r = setup();
    r.current.scrollBeginDragHandler();
    r.current.scrollHandler(scrollTo(300));
    expect(r.current.isScrolledDown.get()).toBe(true);

    r.current.scrollHandler(scrollTo(280));
    r.current.scrollHandler(scrollTo(240));

    expect(r.current.isScrolledDown.get()).toBe(false);
  });

  it('always reveals the bar near the top, whatever moved the list', () => {
    const r = setup();
    r.current.scrollBeginDragHandler();
    r.current.scrollHandler(scrollTo(300));
    expect(r.current.isScrolledDown.get()).toBe(true);

    r.current.scrollHandler(scrollTo(40));

    expect(r.current.isScrolledDown.get()).toBe(false);
  });

  it('never hides the bar for a scroll no finger drove', () => {
    const r = setup();

    // No scrollBeginDragHandler — a layout or programmatic scroll.
    r.current.scrollHandler(scrollTo(300));
    r.current.scrollHandler(scrollTo(600));

    expect(r.current.isScrolledDown.get()).toBe(false);
  });

  it('tracks the offset even while it leaves the bar alone', () => {
    const r = setup();

    r.current.scrollHandler(scrollTo(420));

    expect(r.current.scrollY.get()).toBe(420);
  });

  it('reveals the bar when a drag ends with no momentum to follow', () => {
    const r = setup();
    r.current.scrollBeginDragHandler();
    r.current.scrollHandler(scrollTo(300));
    expect(r.current.isScrolledDown.get()).toBe(true);

    r.current.scrollEndDragHandler(endDragAt(0));

    expect(r.current.isScrolledDown.get()).toBe(false);
    expect(r.current.isUserDragging.get()).toBe(false);
  });

  it('keeps the bar hidden when a drag ends into momentum', () => {
    const r = setup();
    r.current.scrollBeginDragHandler();
    r.current.scrollHandler(scrollTo(300));

    r.current.scrollEndDragHandler(endDragAt(2.4));

    expect(r.current.isScrolledDown.get()).toBe(true);
    expect(r.current.isUserDragging.get()).toBe(true);
  });

  it('reveals the bar when momentum comes to rest', () => {
    const r = setup();
    r.current.scrollBeginDragHandler();
    r.current.scrollHandler(scrollTo(300));

    r.current.momentumEndHandler();

    expect(r.current.isScrolledDown.get()).toBe(false);
    expect(r.current.isUserDragging.get()).toBe(false);
  });

  it('measures a new drag from where it began, not from the previous run', () => {
    const r = setup();
    r.current.scrollBeginDragHandler();
    r.current.scrollHandler(scrollTo(300));
    r.current.momentumEndHandler();
    expect(r.current.isScrolledDown.get()).toBe(false);

    // A fresh drag re-anchors, so this 30px move is short of the travel the bar
    // requires even though the offset is far from where the last run started.
    r.current.scrollBeginDragHandler();
    r.current.scrollHandler(scrollTo(330));

    expect(r.current.isScrolledDown.get()).toBe(false);
  });
});
