import { renderHook, act } from '@testing-library/react-native';
import { useSelectorManagement } from '../useSelectorManagement';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSelectorManagement', () => {
  const createMockRef = (openFn = jest.fn()) => ({
    current: {
      open: openFn,
      close: jest.fn(),
      isActive: jest.fn(() => false),
      toggle: jest.fn(),
    },
  });

  it('returns handleOpenSelector, handleOverlayOpen, and handleOverlayClose', () => {
    const selectorRef = createMockRef();
    const setOverlayOpen = jest.fn();

    const { result } = renderHook(() =>
      useSelectorManagement({ selectorRef, setOverlayOpen }),
    );

    expect(result.current.handleOpenSelector).toBeInstanceOf(Function);
    expect(result.current.handleOverlayOpen).toBeInstanceOf(Function);
    expect(result.current.handleOverlayClose).toBeInstanceOf(Function);
  });

  it('handleOpenSelector calls setOverlayOpen(true) and selectorRef.current.open()', () => {
    const mockOpen = jest.fn();
    const selectorRef = createMockRef(mockOpen);
    const setOverlayOpen = jest.fn();

    const { result } = renderHook(() =>
      useSelectorManagement({ selectorRef, setOverlayOpen }),
    );

    act(() => {
      result.current.handleOpenSelector();
    });

    expect(setOverlayOpen).toHaveBeenCalledWith(true);
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('handleOpenSelector does not throw when selectorRef.current is null', () => {
    const selectorRef = { current: null };
    const setOverlayOpen = jest.fn();

    const { result } = renderHook(() =>
      useSelectorManagement({ selectorRef, setOverlayOpen }),
    );

    expect(() => {
      act(() => {
        result.current.handleOpenSelector();
      });
    }).not.toThrow();

    expect(setOverlayOpen).toHaveBeenCalledWith(true);
  });

  it('handleOverlayOpen calls setOverlayOpen(true)', () => {
    const selectorRef = createMockRef();
    const setOverlayOpen = jest.fn();

    const { result } = renderHook(() =>
      useSelectorManagement({ selectorRef, setOverlayOpen }),
    );

    act(() => {
      result.current.handleOverlayOpen();
    });

    expect(setOverlayOpen).toHaveBeenCalledWith(true);
  });

  it('handleOverlayClose calls setOverlayOpen(false)', () => {
    const selectorRef = createMockRef();
    const setOverlayOpen = jest.fn();

    const { result } = renderHook(() =>
      useSelectorManagement({ selectorRef, setOverlayOpen }),
    );

    act(() => {
      result.current.handleOverlayClose();
    });

    expect(setOverlayOpen).toHaveBeenCalledWith(false);
  });

  it('multiple calls to handlers invoke setOverlayOpen correctly', () => {
    const selectorRef = createMockRef();
    const setOverlayOpen = jest.fn();

    const { result } = renderHook(() =>
      useSelectorManagement({ selectorRef, setOverlayOpen }),
    );

    act(() => {
      result.current.handleOverlayOpen();
    });
    act(() => {
      result.current.handleOverlayClose();
    });
    act(() => {
      result.current.handleOpenSelector();
    });

    expect(setOverlayOpen).toHaveBeenCalledTimes(3);
    expect(setOverlayOpen).toHaveBeenNthCalledWith(1, true);
    expect(setOverlayOpen).toHaveBeenNthCalledWith(2, false);
    expect(setOverlayOpen).toHaveBeenNthCalledWith(3, true);
  });

  it('works with a fresh ref after re-render', () => {
    const setOverlayOpen = jest.fn();
    const selectorRef = { current: null as any };

    const { result } = renderHook(() =>
      useSelectorManagement({ selectorRef, setOverlayOpen }),
    );

    // Initially null ref
    act(() => {
      result.current.handleOpenSelector();
    });
    expect(setOverlayOpen).toHaveBeenCalledWith(true);

    // Now set the ref
    const mockOpen = jest.fn();
    selectorRef.current = {
      open: mockOpen,
      close: jest.fn(),
      isActive: jest.fn(() => false),
      toggle: jest.fn(),
    };

    act(() => {
      result.current.handleOpenSelector();
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });
});
