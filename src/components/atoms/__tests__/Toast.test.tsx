import React, { useEffect, useRef } from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { usePanGesture } from 'react-native-gesture-handler';
import { withSpring } from 'react-native-reanimated';
import { Text } from '#components/atoms/Text';
import { scheduleOnRN } from 'react-native-worklets';
import { ToastProvider, type ToastFn, type ToastType } from '../Toast';
import { useToast } from '../../../hooks/useToast';

// Mock the toastService bridge — the Toast tests don't exercise the
// imperative API, only the Provider's internal state machine.
jest.mock('#/services/toastService', () => ({
  _setToastDispatch: jest.fn(),
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const usePanGestureMock = usePanGesture as unknown as jest.Mock;
const scheduleOnRNMock = scheduleOnRN as unknown as jest.Mock;

// Each render calls usePanGesture(config); the mock returns the config, so the
// latest result carries the gesture's props + callbacks (onUpdate/onDeactivate).
const getLatestPanGesture = () => {
  const results = usePanGestureMock.mock.results;
  return results[results.length - 1].value;
};

// Helper component that triggers a toast once on mount
const ToastTrigger: React.FC<{
  message: string;
  type?: ToastType;
  action?: { label: string; onPress: () => void };
}> = ({ message, type, action }) => {
  const showToast = useToast();
  const triggered = useRef(false);
  useEffect(() => {
    if (!triggered.current) {
      triggered.current = true;
      showToast({ message, type, action });
    }
  }, [message, type, action, showToast]);
  return <Text>Trigger</Text>;
};

// Hands the context's showToast back out so a test can fire toasts on demand.
const ToastCapture: React.FC<{ onReady: (show: ToastFn) => void }> = ({
  onReady,
}) => {
  const showToast = useToast();
  useEffect(() => {
    onReady(showToast);
  }, [onReady, showToast]);
  return null;
};

describe('ToastProvider', () => {
  it('renders children', () => {
    render(
      <ToastProvider>
        <Text>Child Content</Text>
      </ToastProvider>,
    );
    expect(screen.getByText('Child Content')).toBeTruthy();
  });

  it('provides toast context to children', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Hello" />
      </ToastProvider>,
    );
    expect(screen.getByText('Trigger')).toBeTruthy();
  });

  it('displays toast message', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Toast message" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-message')).toBeTruthy();
    expect(screen.getByText('Toast message')).toBeTruthy();
  });

  it('displays toast with success type', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Saved!" type="success" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-success')).toBeTruthy();
  });

  it('displays toast with error type', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Failed!" type="error" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-error')).toBeTruthy();
  });

  it('renders toast with warning type without crashing', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Warning!" type="warning" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-warning')).toBeTruthy();
    expect(screen.getByText('Warning!')).toBeTruthy();
  });

  it('renders action button when action is provided', () => {
    const onPress = jest.fn();
    render(
      <ToastProvider>
        <ToastTrigger
          message="Failed!"
          type="error"
          action={{ label: 'Retry', onPress }}
        />
      </ToastProvider>,
    );
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  describe('swipe-to-dismiss gesture', () => {
    beforeEach(() => {
      usePanGestureMock.mockClear();
      scheduleOnRNMock.mockClear();
    });

    it('configures the pan gesture with a 10pt activation threshold', () => {
      render(
        <ToastProvider>
          <ToastTrigger message="Hello" />
        </ToastProvider>,
      );
      const gesture = getLatestPanGesture();
      expect(gesture.minDistance).toBe(10);
    });

    it('dismisses on upward swipe past threshold', () => {
      render(
        <ToastProvider>
          <ToastTrigger message="Hello" />
        </ToastProvider>,
      );
      const gesture = getLatestPanGesture();
      const onEnd = gesture.onDeactivate;

      onEnd({ translationY: -80, translationX: 0 });

      expect(scheduleOnRNMock).toHaveBeenCalledTimes(1);
      expect(typeof scheduleOnRNMock.mock.calls[0][0]).toBe('function');
    });

    it('dismisses on horizontal swipe past threshold', () => {
      render(
        <ToastProvider>
          <ToastTrigger message="Hello" />
        </ToastProvider>,
      );
      const gesture = getLatestPanGesture();
      const onEnd = gesture.onDeactivate;

      onEnd({ translationY: 0, translationX: 80 });

      expect(scheduleOnRNMock).toHaveBeenCalledTimes(1);
    });

    it('does not dismiss on small swipe below threshold', () => {
      render(
        <ToastProvider>
          <ToastTrigger message="Hello" />
        </ToastProvider>,
      );
      const gesture = getLatestPanGesture();
      const onEnd = gesture.onDeactivate;

      onEnd({ translationY: -20, translationX: 10 });

      expect(scheduleOnRNMock).not.toHaveBeenCalled();
    });

    it('does not dismiss on downward swipe (top-positioned toast)', () => {
      render(
        <ToastProvider>
          <ToastTrigger message="Hello" />
        </ToastProvider>,
      );
      const gesture = getLatestPanGesture();
      const onEnd = gesture.onDeactivate;

      onEnd({ translationY: 100, translationX: 0 });

      expect(scheduleOnRNMock).not.toHaveBeenCalled();
    });
  });

  describe('dismissal', () => {
    const withSpringMock = withSpring as unknown as jest.Mock;
    const passThrough = (toValue: unknown) => toValue;
    const invokeImmediately = (
      fn: ((...args: unknown[]) => unknown) | undefined,
      ...args: unknown[]
    ) => fn?.(...args);

    const swipeAway = () =>
      act(() => {
        getLatestPanGesture().onDeactivate({
          translationY: -80,
          translationX: 0,
        });
      });

    beforeEach(() => {
      usePanGestureMock.mockClear();
      scheduleOnRNMock.mockClear();
      // The shared mock drops the completion callback, so the dismissal chain
      // would stall at the spring. Settle it like the withTiming mock does.
      withSpringMock.mockImplementation((toValue, _config, callback) => {
        if (typeof callback === 'function') callback(true);
        return toValue;
      });
    });

    afterEach(() => {
      withSpringMock.mockImplementation(passThrough);
      scheduleOnRNMock.mockImplementation(invokeImmediately);
    });

    it('keeps the message and type rendered after dismissal completes', () => {
      render(
        <ToastProvider>
          <ToastTrigger message="Saved!" type="success" />
        </ToastProvider>,
      );

      swipeAway();

      // The container never unmounts — it only animates away. Clearing its
      // content here would drop the success variant and expose the base
      // style, which is a near-white box in the dark theme.
      expect(screen.getByText('Saved!')).toBeTruthy();
      expect(screen.getByTestId('toast-success')).toBeTruthy();
      expect(screen.queryByTestId('toast-default')).toBeNull();
    });

    it('ignores a dismissal that lands after a newer toast took over', () => {
      let show: ToastFn | undefined;
      render(
        <ToastProvider>
          <ToastCapture
            onReady={fn => {
              show = fn;
            }}
          />
        </ToastProvider>,
      );
      act(() => {
        show?.({ message: 'First', type: 'success' });
      });

      // Capture each hop instead of running it, so the second toast can slot
      // into the gap between the spring settling and its callback reaching JS.
      scheduleOnRNMock.mockImplementation(() => {});
      swipeAway();

      const [animateDismiss, dismissedGeneration] =
        scheduleOnRNMock.mock.calls[0];
      act(() => animateDismiss(dismissedGeneration));
      const [onDismissComplete, completedGeneration] =
        scheduleOnRNMock.mock.calls[1];

      act(() => {
        show?.({ message: 'Second', type: 'success' });
      });
      act(() => onDismissComplete(completedGeneration));

      expect(screen.getByText('Second')).toBeTruthy();
      // Clearing here would cancel the second toast's own auto-dismiss timer
      // via the enter effect's cleanup, stranding it on screen. `pointerEvents`
      // tracks whether a toast is still live.
      expect(screen.getByTestId('toast-success').props.pointerEvents).toBe(
        'auto',
      );
    });
  });
});
