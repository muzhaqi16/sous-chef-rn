import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { PhotoCaptureSheet } from '../PhotoCaptureSheet';

const mockStart = jest.fn();
jest.mock('#features/recipes/hooks/useRecipeCapture', () => ({
  useRecipeCapture: () => ({ start: mockStart, sending: false }),
}));
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
jest.mock('#features/recipes/hooks/useCapturePhotos', () => ({
  useCapturePhotos: () => mockPhotos,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPhotos = { ...mockPhotos, pages: [], canAddPage: true };
  mockStart.mockResolvedValue({ kind: 'started' });
});

const renderSheet = () => {
  const onDismiss = jest.fn();
  render(<PhotoCaptureSheet visible onDismiss={onDismiss} />);
  return onDismiss;
};
const sendButton = () => screen.getByTestId(recipesTestIDs.captureSend);

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
});
