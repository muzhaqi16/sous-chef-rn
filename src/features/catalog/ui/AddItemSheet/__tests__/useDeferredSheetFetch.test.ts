import { act, renderHook } from '@testing-library/react-native';
import { useDeferredSheetFetch } from '../useDeferredSheetFetch';

// Frames are held until a test runs them, so "the frame after it opens" is a
// step the test takes.
let frames: Array<() => void> = [];
const runFrames = () =>
  act(() => {
    const pending = frames;
    frames = [];
    pending.forEach(frame => frame());
  });

beforeEach(() => {
  frames = [];
  jest
    .spyOn(global, 'requestAnimationFrame')
    .mockImplementation((cb: (time: number) => void) => {
      frames.push(() => cb(0));
      return frames.length;
    });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

type Props = Parameters<typeof useDeferredSheetFetch>[0];

const render = (props: Props) =>
  renderHook((p: Props) => useDeferredSheetFetch(p), { initialProps: props });

describe('useDeferredSheetFetch', () => {
  it('fetches nothing while closed', () => {
    const { result } = render({ open: false, contextId: 'list-1' });
    runFrames();
    expect(result.current).toBe(false);
  });

  it('fetches from the frame after it opens', () => {
    const { result } = render({ open: true, contextId: 'list-1' });
    expect(result.current).toBe(false);
    runFrames();
    expect(result.current).toBe(true);
  });

  it('fetches at once with the deferral off', () => {
    const { result } = render({
      open: true,
      contextId: 'list-1',
      deferFetch: false,
    });
    expect(result.current).toBe(true);
  });

  it('waits again on every opening', () => {
    const { result, rerender } = render({ open: true, contextId: 'list-1' });
    runFrames();
    rerender({ open: false, contextId: 'list-1' });
    expect(result.current).toBe(false);

    rerender({ open: true, contextId: 'list-1' });
    expect(result.current).toBe(false);
    runFrames();
    expect(result.current).toBe(true);
  });

  it('waits again for another list opened in place', () => {
    const { result, rerender } = render({ open: true, contextId: 'list-1' });
    runFrames();
    rerender({ open: true, contextId: 'list-2' });
    expect(result.current).toBe(false);
    runFrames();
    expect(result.current).toBe(true);
  });
});
