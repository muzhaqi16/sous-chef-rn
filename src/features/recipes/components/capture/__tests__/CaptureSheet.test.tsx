import React from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { appConfig } from '#/config/appConfig';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { useRecipeCapture } from '#features/recipes/hooks/useRecipeCapture';
import { CreateRecipeCaptureDocument } from '#features/recipes/hooks/useRecipeCapture.generated';
import { CaptureSheet, MAX_CAPTURE_TEXT } from '../CaptureSheet';

jest.mock('#hooks/navigation/useAppNavigation');

const mockStart = jest.fn();
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: () => false,
}));

// Wired as the screen wires it: the sheet sends through the capture hook.
const SheetSendingACapture = ({ onDismiss }: { onDismiss: () => void }) => {
  const { start, sending } = useRecipeCapture();
  return (
    <CaptureSheet
      visible
      kind="link"
      textAllowed
      onSend={start}
      sending={sending}
      onDismiss={onDismiss}
    />
  );
};

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
      onSend={mockStart}
      sending={false}
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

  it.each([
    { name: 'without its scheme', link: 'example-cooking.com/miso' },
    {
      name: 'longer than the API reads',
      link: `https://example-cooking.com/${'a'.repeat(2049 - 28)}`,
    },
  ])('refuses a link $name on the field, sending nothing', async ({ link }) => {
    renderSheet('link');

    type(recipesTestIDs.captureUrlInput, link);
    send();

    expect(
      await screen.findByText(
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

  // The server's refusals read in the copy their codes have everywhere.
  it.each([
    {
      code: TopLevelErrorCode.ClientUpgradeRequired,
      extensions: {},
      copy: `This version of ${appConfig.identity.displayName} is out of date. Please update to continue.`,
    },
    {
      code: TopLevelErrorCode.FeatureDisabled,
      extensions: { feature: 'RECIPE_CAPTURE_URL' },
      copy: "This isn't available on your account right now.",
    },
    {
      code: TopLevelErrorCode.PremiumRequired,
      extensions: { feature: 'RECIPE_CAPTURE_URL', plan: 'PREMIUM' },
      copy: 'This needs a Premium plan.',
    },
  ])(
    'says $code in its own words, staying open',
    async ({ code, extensions, copy }) => {
      const refused = recordMock(CreateRecipeCaptureDocument, {
        error: new CombinedGraphQLErrors({
          errors: [{ message: 'refused', extensions: { code, ...extensions } }],
        }),
      });
      const onDismiss = jest.fn();
      renderWithApollo(<SheetSendingACapture onDismiss={onDismiss} />, {
        operationMocks: [refused.mock],
      });

      type(recipesTestIDs.captureUrlInput, 'https://example-cooking.com/miso');
      send();

      expect(await screen.findByText(copy)).toBeTruthy();
      expect(refused.fired).toHaveLength(1);
      expect(onDismiss).not.toHaveBeenCalled();
    },
  );
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
