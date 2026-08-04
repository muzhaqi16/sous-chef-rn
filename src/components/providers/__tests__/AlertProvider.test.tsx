/**
 * A run of identical failures must not stack one modal per failure.
 *
 * Every tap on a control while the API was down produced its own
 * "Failed to update settings" alert, appended to an unbounded list — so the
 * user had to dismiss the same message N times and it read as an alert that
 * wouldn't go away. Repeats of a purely informational alert now collapse;
 * anything carrying a decision never does.
 *
 * The assertions dismiss and re-check rather than counting rendered cards: the
 * stack renders depth cards behind the top one at reduced opacity, which RNTL's
 * queries treat as hidden, so only the newest alert is ever queryable. What
 * matters is how many dismissals it takes to clear the queue.
 */
import React from 'react';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { AlertProvider } from '../AlertProvider';
import { alertService } from '#/services/alertService';

const FAILED = 'Failed to update settings. Please try again.';

const renderProvider = () =>
  render(
    <AlertProvider>
      <Text>content</Text>
    </AlertProvider>,
  );

const showAlert = (
  title: string,
  message: string,
  buttons?: Parameters<typeof alertService.alert>[2],
) => act(() => alertService.alert(title, message, buttons));

describe('AlertProvider', () => {
  it('collapses a repeated informational alert into one dismissal', async () => {
    const user = userEvent.setup();
    renderProvider();

    showAlert('Error', FAILED);
    showAlert('Error', FAILED);
    showAlert('Error', FAILED);

    expect(await screen.findByText(FAILED)).toBeTruthy();

    // One dismissal clears all three — they were the same message.
    await user.press(screen.getByText('OK'));

    expect(screen.queryByText(FAILED)).toBeNull();
  });

  it('keeps distinct informational alerts separate', async () => {
    const user = userEvent.setup();
    renderProvider();

    showAlert('Error', FAILED);
    showAlert('Error', 'Failed to add item');

    expect(await screen.findByText('Failed to add item')).toBeTruthy();
    await user.press(screen.getByText('OK'));

    // The earlier, different alert is still waiting.
    expect(await screen.findByText(FAILED)).toBeTruthy();
  });

  it('never collapses alerts that carry a decision', async () => {
    const user = userEvent.setup();
    renderProvider();
    const onPress = jest.fn();
    const confirmButtons = [
      { text: 'Cancel', style: 'cancel' as const },
      { text: 'Delete', style: 'destructive' as const, onPress },
    ];

    // Identical confirmations: dropping one would drop its callback.
    showAlert('Delete Item', 'Are you sure?', confirmButtons);
    showAlert('Delete Item', 'Are you sure?', confirmButtons);

    expect(await screen.findByText('Are you sure?')).toBeTruthy();
    await user.press(screen.getByText('Delete'));

    // Second confirmation survives, and its callback is still pending.
    expect(await screen.findByText('Are you sure?')).toBeTruthy();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
