import React from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { CaptureSheet, MAX_CAPTURE_TEXT } from '../CaptureSheet';

const mockStart = jest.fn();
jest.mock('#features/recipes/hooks/useRecipeCapture', () => ({
  useRecipeCapture: () => ({ start: mockStart, sending: false }),
}));
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: () => false,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStart.mockResolvedValue({ kind: 'started' });
});

const renderSheet = (kind: 'link' | 'text', textAllowed = true) => {
  const onDismiss = jest.fn();
  render(
    <CaptureSheet
      visible
      kind={kind}
      textAllowed={textAllowed}
      onDismiss={onDismiss}
    />,
  );
  return onDismiss;
};

const type = (testID: string, text: string) =>
  fireEvent.changeText(screen.getByTestId(testID), text);
const send = () =>
  fireEvent.press(screen.getByTestId(recipesTestIDs.captureSend));

describe('CaptureSheet: from a link', () => {
  it('sends a page link and closes', async () => {
    const onDismiss = renderSheet('link');

    type(recipesTestIDs.captureUrlInput, ' https://example-cooking.com/miso ');
    send();

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(mockStart).toHaveBeenCalledWith({
      source: 'url',
      url: 'https://example-cooking.com/miso',
    });
  });

  it('says on the field what a full link looks like, sending nothing', () => {
    renderSheet('link');

    type(recipesTestIDs.captureUrlInput, 'example-cooking.com/miso');
    send();

    expect(
      screen.getByText(
        'Enter the full link, starting with http:// or https://',
      ),
    ).toBeTruthy();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('pastes the link the clipboard holds', async () => {
    jest
      .mocked(Clipboard.getString)
      .mockResolvedValueOnce('https://example-cooking.com/miso');
    renderSheet('link');

    fireEvent.press(screen.getByText('Paste link'));

    await waitFor(() =>
      expect(
        screen.getByTestId(recipesTestIDs.captureUrlInput).props.value,
      ).toBe('https://example-cooking.com/miso'),
    );
  });

  it('offers the text instead of a link the server will not read, keeping the link', async () => {
    mockStart.mockResolvedValueOnce({ kind: 'refused', field: 'url' });
    renderSheet('link');

    type(recipesTestIDs.captureUrlInput, 'https://www.tiktok.com/@chef/1');
    send();

    await waitFor(() =>
      expect(
        screen.getByText(
          "This link can't be read directly. Paste the post's text instead.",
        ),
      ).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId(recipesTestIDs.captureUseText));

    expect(screen.getByTestId(recipesTestIDs.captureTextInput)).toBeTruthy();
    expect(
      screen.getByTestId(recipesTestIDs.captureSourceInput).props.value,
    ).toBe('https://www.tiktok.com/@chef/1');
  });

  it('offers no text where text capture is off', async () => {
    mockStart.mockResolvedValueOnce({ kind: 'refused', field: 'url' });
    renderSheet('link', false);

    type(recipesTestIDs.captureUrlInput, 'https://www.tiktok.com/@chef/1');
    send();

    await waitFor(() =>
      expect(
        screen.getByText("This link can't be read directly."),
      ).toBeTruthy(),
    );
    expect(screen.queryByTestId(recipesTestIDs.captureUseText)).toBeNull();
  });

  it('says the daily allowance is spent', async () => {
    mockStart.mockResolvedValueOnce({ kind: 'limited' });
    renderSheet('link');

    type(recipesTestIDs.captureUrlInput, 'https://example-cooking.com/miso');
    send();

    await waitFor(() =>
      expect(
        screen.getByText(
          "You've imported as many recipes as you can today. Try again tomorrow.",
        ),
      ).toBeTruthy(),
    );
  });
});

describe('CaptureSheet: from text', () => {
  it('sends a caption with where it came from', async () => {
    renderSheet('text');

    type(recipesTestIDs.captureTextInput, 'Miso salmon\n2 tbsp miso');
    type(recipesTestIDs.captureSourceInput, 'https://www.instagram.com/p/1/');
    send();

    await waitFor(() =>
      expect(mockStart).toHaveBeenCalledWith({
        source: 'text',
        text: 'Miso salmon\n2 tbsp miso',
        sourceUrl: 'https://www.instagram.com/p/1/',
      }),
    );
  });

  it('holds no more text than the server reads, and counts it', () => {
    renderSheet('text');

    expect(
      screen.getByTestId(recipesTestIDs.captureTextInput).props.maxLength,
    ).toBe(MAX_CAPTURE_TEXT);
    type(recipesTestIDs.captureTextInput, 'Miso');
    expect(screen.getByText(`4 / ${MAX_CAPTURE_TEXT}`)).toBeTruthy();
  });
});
