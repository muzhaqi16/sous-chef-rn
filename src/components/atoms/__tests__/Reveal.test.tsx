import React from 'react';
import { Text } from '#components/atoms/Text';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { motion } from '#/theme/foundations/motion';
import { Reveal } from '../Reveal';

const layOut = (text: string) =>
  fireEvent(screen.getByText(text), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 48 } },
  });

describe('Reveal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows content open from the first render, and none closed from it', () => {
    render(
      <>
        <Reveal open>
          <Text>Store</Text>
        </Reveal>
        <Reveal open={false}>
          <Text>Date</Text>
        </Reveal>
      </>,
    );

    expect(screen.getByText('Store')).toBeTruthy();
    expect(screen.queryByText('Date')).toBeNull();
  });

  it('opens again after a close, and keeps the content until the close has run', () => {
    const { rerender } = render(
      <Reveal open={false}>
        <Text>Date</Text>
      </Reveal>,
    );

    rerender(
      <Reveal open>
        <Text>Date</Text>
      </Reveal>,
    );
    layOut('Date');
    rerender(
      <Reveal open={false}>
        <Text>Date</Text>
      </Reveal>,
    );
    // Still there while it shrinks away.
    expect(screen.getByText('Date')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(motion.timing.STANDARD);
    });
    expect(screen.queryByText('Date')).toBeNull();

    rerender(
      <Reveal open>
        <Text>Date</Text>
      </Reveal>,
    );
    expect(screen.getByText('Date')).toBeTruthy();
  });
});
