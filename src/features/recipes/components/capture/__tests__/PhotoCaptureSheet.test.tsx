import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { useRecipeCapture } from '#features/recipes/hooks/useRecipeCapture';
import { CreateRecipeCaptureDocument } from '#features/recipes/hooks/useRecipeCapture.generated';
import { PhotoCaptureSheet } from '../PhotoCaptureSheet';

jest.mock('#hooks/navigation/useAppNavigation');

const mockStart = jest.fn();
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: () => false,
}));
let mockPhotos = {
  pages: [] as string[],
  canAddPage: true,
  scannerUnavailable: false,
  uploading: false,
  scan: jest.fn(),
  choose: jest.fn(),
  remove: jest.fn(),
  upload: jest.fn(),
  discard: jest.fn(),
};
jest.mock('#features/recipes/components/capture/useCapturePhotos', () => ({
  useCapturePhotos: () => mockPhotos,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPhotos = { ...mockPhotos, pages: [], canAddPage: true };
  mockStart.mockResolvedValue({ kind: 'started' });
});

const renderSheet = () => {
  const onDismiss = jest.fn();
  render(
    <PhotoCaptureSheet
      visible
      onSend={mockStart}
      sending={false}
      onDismiss={onDismiss}
    />,
  );
  return onDismiss;
};
const sendButton = () => screen.getByTestId(recipesTestIDs.captureSend);

// Wired as the screen wires it: the sheet sends through the capture hook.
const SheetSendingACapture = ({ onDismiss }: { onDismiss: () => void }) => {
  const { start, sending } = useRecipeCapture();
  return (
    <PhotoCaptureSheet
      visible
      onSend={start}
      sending={sending}
      onDismiss={onDismiss}
    />
  );
};

describe('PhotoCaptureSheet', () => {
  it('sends nothing before a page is added', () => {
    renderSheet();
    expect(sendButton().props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('sends the uploaded pages as one capture and closes', async () => {
    mockPhotos.pages = ['p1', 'p2'];
    mockPhotos.upload.mockResolvedValueOnce(['key-1', 'key-2']);
    const onDismiss = renderSheet();

    fireEvent.press(sendButton());

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(mockStart).toHaveBeenCalledWith({
      source: 'photo',
      photoKeys: ['key-1', 'key-2'],
    });
  });

  it('says the photos did not upload, keeping them', async () => {
    mockPhotos.pages = ['p1'];
    mockPhotos.upload.mockResolvedValueOnce(null);
    renderSheet();

    fireEvent.press(sendButton());

    await waitFor(() =>
      expect(
        screen.getByText(
          "The photos didn't upload. Check your connection and try again.",
        ),
      ).toBeTruthy(),
    );
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('adds no page past the third', () => {
    mockPhotos.pages = ['p1', 'p2', 'p3'];
    mockPhotos.canAddPage = false;
    renderSheet();

    expect(
      screen.getByTestId(recipesTestIDs.captureChoosePhotos).props
        .accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it('says a plan is needed when the server refuses for one, staying open', async () => {
    mockPhotos.pages = ['p1'];
    mockPhotos.upload.mockResolvedValueOnce(['key-1']);
    const refused = recordMock(CreateRecipeCaptureDocument, {
      error: new CombinedGraphQLErrors({
        errors: [
          {
            message: 'refused',
            extensions: {
              code: TopLevelErrorCode.PremiumRequired,
              feature: 'RECIPE_CAPTURE_PHOTO',
              plan: 'PREMIUM',
            },
          },
        ],
      }),
    });
    const onDismiss = jest.fn();
    renderWithApollo(<SheetSendingACapture onDismiss={onDismiss} />, {
      operationMocks: [refused.mock],
    });

    fireEvent.press(sendButton());

    expect(await screen.findByText('This needs a Premium plan.')).toBeTruthy();
    expect(refused.fired).toHaveLength(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
