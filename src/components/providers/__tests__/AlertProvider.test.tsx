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

  describe('exactly one alert is addressable at a time', () => {
    // The stack renders up to ALERT.MAX_VISIBLE cards at once. RNTL treats the
    // card behind as hidden (reduced opacity), which is why the tests above can
    // ignore it — but Detox does not, and a second `alert-modal` on screen
    // turns `by.id('alert-modal')` into a multiple-match error instead of the
    // assertion the spec was making. So these query hidden elements too: that
    // is the view the e2e layer actually gets.
    const allWithHidden = (id: string) =>
      screen.queryAllByTestId(id, { includeHiddenElements: true });

    const showTwoStackedAlerts = () => {
      // Distinct titles and a decision button apiece, so neither the
      // informational collapse nor the identical-confirmation rule merges them.
      showAlert('First', 'first message', [{ text: 'OK' }]);
      showAlert('Second', 'second message', [{ text: 'OK' }]);
    };

    it('gives the stable id to the top card only', async () => {
      renderProvider();
      showTwoStackedAlerts();
      expect(await screen.findByText('second message')).toBeTruthy();

      expect(allWithHidden('alert-modal')).toHaveLength(1);
      // The one behind is still present and inspectable, just not 'the alert'.
      expect(allWithHidden('alert-modal-behind')).toHaveLength(1);
    });

    it('gives button ids to the top card only', async () => {
      renderProvider();
      showTwoStackedAlerts();
      expect(await screen.findByText('second message')).toBeTruthy();

      // Both cards render a button at index 0; only one answers to the id.
      expect(allWithHidden('alert-button-0')).toHaveLength(1);
    });

    it('still exposes the alert when only one is showing', async () => {
      renderProvider();
      showAlert('Only', 'only message', [{ text: 'OK' }]);
      expect(await screen.findByText('only message')).toBeTruthy();

      expect(allWithHidden('alert-modal')).toHaveLength(1);
      expect(allWithHidden('alert-button-0')).toHaveLength(1);
      expect(allWithHidden('alert-modal-behind')).toHaveLength(0);
    });
  });
});
