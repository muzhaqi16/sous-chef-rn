import React, { useEffect, useRef } from 'react';
import { render, screen } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';
import { Text } from '#components/atoms/Text';
import { scheduleOnRN } from 'react-native-worklets';
import { ToastProvider, type ToastType } from '../Toast';
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

const PanMock = Gesture.Pan as unknown as jest.Mock;
const scheduleOnRNMock = scheduleOnRN as unknown as jest.Mock;

const getLatestPanGesture = () => {
  const results = PanMock.mock.results;
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
      PanMock.mockClear();
      scheduleOnRNMock.mockClear();
    });

    it('configures the pan gesture with a 10pt activation threshold', () => {
      render(
        <ToastProvider>
          <ToastTrigger message="Hello" />
        </ToastProvider>,
      );
      const gesture = getLatestPanGesture();
      expect(gesture.minDistance).toHaveBeenCalledWith(10);
    });

    it('dismisses on upward swipe past threshold', () => {
      render(
        <ToastProvider>
          <ToastTrigger message="Hello" />
        </ToastProvider>,
      );
      const gesture = getLatestPanGesture();
      const onEnd = gesture.onEnd.mock.calls[0][0];

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
      const onEnd = gesture.onEnd.mock.calls[0][0];

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
      const onEnd = gesture.onEnd.mock.calls[0][0];

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
      const onEnd = gesture.onEnd.mock.calls[0][0];

      onEnd({ translationY: 100, translationX: 0 });

      expect(scheduleOnRNMock).not.toHaveBeenCalled();
    });
  });
});
