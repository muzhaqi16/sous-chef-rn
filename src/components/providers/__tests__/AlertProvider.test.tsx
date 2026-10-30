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
jest.unmock('#/services/alertService');
import React from 'react';
import { Platform } from 'react-native';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { Modal } from '#components/atoms/themedComponents';
import { AlertProvider } from '../AlertProvider';
import { alertService } from '#/services/alertService';
import { drainTimers } from '#/test-utils/drainTimers';

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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AlertProvider', () => {
  it('collapses a repeated informational alert into one dismissal', async () => {
    const user = userEvent.setup();
    renderProvider();

    showAlert('Error', FAILED);
    showAlert('Error', FAILED);
    showAlert('Error', FAILED);

    await drainTimers();
    expect(screen.getByText(FAILED)).toBeTruthy();

    // One dismissal clears all three — they were the same message.
    await user.press(screen.getByText('OK'));

    expect(screen.queryByText(FAILED)).toBeNull();
  });

  it('keeps distinct informational alerts separate', async () => {
    const user = userEvent.setup();
    renderProvider();

    showAlert('Error', FAILED);
    showAlert('Error', 'Failed to add item');

    await drainTimers();
    expect(screen.getByText('Failed to add item')).toBeTruthy();
    await user.press(screen.getByText('OK'));

    // The earlier, different alert is still waiting.
    await drainTimers();
    expect(screen.getByText(FAILED)).toBeTruthy();
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

    await drainTimers();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
    await user.press(screen.getByText('Delete'));

    // Second confirmation survives, and its callback is still pending.
    await drainTimers();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
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
      await drainTimers();
      expect(screen.getByText('second message')).toBeTruthy();

      expect(allWithHidden('alert-modal')).toHaveLength(1);
      // The one behind is still present and inspectable, just not 'the alert'.
      expect(allWithHidden('alert-modal-behind')).toHaveLength(1);
    });

    it('gives button ids to the top card only', async () => {
      renderProvider();
      showTwoStackedAlerts();
      await drainTimers();
      expect(screen.getByText('second message')).toBeTruthy();

      // Both cards render a button at index 0; only one answers to the id.
      expect(allWithHidden('alert-button-0')).toHaveLength(1);
    });

    it('still exposes the alert when only one is showing', async () => {
      renderProvider();
      showAlert('Only', 'only message', [{ text: 'OK' }]);
      await drainTimers();
      expect(screen.getByText('only message')).toBeTruthy();

      expect(allWithHidden('alert-modal')).toHaveLength(1);
      expect(allWithHidden('alert-button-0')).toHaveLength(1);
      expect(allWithHidden('alert-modal-behind')).toHaveLength(0);
    });
  });

  // An action that presents native UI must not run while the dialog's modal is
  // still presented: iOS would present it from that modal. The Jest Modal never
  // reports its dismissal, so the tests report it as iOS does.
  describe('a button that waits for the dialog to close', () => {
    const originalOS = Platform.OS;
    afterEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: originalOS,
        configurable: true,
      });
    });

    const reportDismissed = () =>
      act(() => {
        (
          screen.UNSAFE_getByType(Modal).props as { onDismiss: () => void }
        ).onDismiss();
      });

    it('runs its action once, after the modal has been dismissed', async () => {
      const user = userEvent.setup();
      renderProvider();
      const scan = jest.fn();
      showAlert('Send photos?', 'consent', [
        { text: 'Send', onPress: scan, afterClose: true },
      ]);

      await drainTimers();
      await user.press(screen.getByText('Send'));
      expect(screen.queryByText('consent')).toBeNull();
      expect(scan).not.toHaveBeenCalled();

      reportDismissed();
      reportDismissed();
      expect(scan).toHaveBeenCalledTimes(1);
    });

    it('runs any other action at the press', async () => {
      const user = userEvent.setup();
      renderProvider();
      const remove = jest.fn();
      showAlert('Delete Item', 'Are you sure?', [
        { text: 'Delete', onPress: remove },
      ]);

      await drainTimers();
      await user.press(screen.getByText('Delete'));
      expect(remove).toHaveBeenCalledTimes(1);
    });

    it('answers a dismissal with the waiting cancel button, after close', async () => {
      renderProvider();
      const textOnly = jest.fn();
      const send = jest.fn();
      showAlert('Send photos?', 'consent', [
        {
          text: 'Text only',
          style: 'cancel',
          onPress: textOnly,
          afterClose: true,
        },
        { text: 'Send', onPress: send, afterClose: true },
      ]);
      await drainTimers();
      expect(screen.getByText('consent')).toBeTruthy();

      act(() => {
        (
          screen.UNSAFE_getByType(Modal).props as {
            onRequestClose: () => void;
          }
        ).onRequestClose();
      });
      expect(textOnly).not.toHaveBeenCalled();

      reportDismissed();
      expect(textOnly).toHaveBeenCalledTimes(1);
      expect(send).not.toHaveBeenCalled();
    });

    it('waits for an alert shown before the close to close too', async () => {
      const user = userEvent.setup();
      renderProvider();
      const scan = jest.fn();
      showAlert('Send photos?', 'consent', [
        { text: 'Send', onPress: scan, afterClose: true },
      ]);
      await drainTimers();
      await user.press(screen.getByText('Send'));

      // The first close is reported while a new alert is already showing.
      showAlert('Offline', 'no connection');
      reportDismissed();
      expect(scan).not.toHaveBeenCalled();

      await drainTimers();
      await user.press(screen.getByText('OK'));
      reportDismissed();
      expect(scan).toHaveBeenCalledTimes(1);
    });

    it('runs a frame after the close on Android, which reports none', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      const user = userEvent.setup();
      renderProvider();
      const scan = jest.fn();
      showAlert('Send photos?', 'consent', [
        { text: 'Send', onPress: scan, afterClose: true },
      ]);

      await drainTimers();
      await user.press(screen.getByText('Send'));
      await drainTimers();
      expect(scan).toHaveBeenCalledTimes(1);
    });
  });
});
