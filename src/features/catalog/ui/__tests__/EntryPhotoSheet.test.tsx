'use no memo';

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { EntryPhotoSheet } from '../EntryPhotoSheet';
import { catalogTestIDs } from '#features/catalog/testIDs';

jest.mock('#hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

const PHOTO = { uri: 'file:///taken.jpg', type: 'image/jpeg' };
const mockTakePhoto = jest.fn();
const mockPickPhoto = jest.fn();
jest.mock('#hooks/device/usePhotoCapture', () => ({
  usePhotoCapture: () => ({
    takePhoto: () => mockTakePhoto(),
    pickPhoto: () => mockPickPhoto(),
  }),
}));

const entryPhoto = () => ({
  setOwnPhoto: jest.fn().mockResolvedValue(true),
  pickItemPhoto: jest.fn().mockResolvedValue(true),
  revertToCatalogPhoto: jest.fn().mockResolvedValue(true),
  busy: false,
});

const renderSheet = (
  props: Partial<React.ComponentProps<typeof EntryPhotoSheet>> = {},
) => {
  const photo = props.entryPhoto ?? entryPhoto();
  const onDismiss = jest.fn();
  renderWithApollo(
    <EntryPhotoSheet
      visible
      onDismiss={onDismiss}
      entryPhoto={photo}
      hasHouseholdPhoto={false}
      {...props}
    />,
  );
  return { photo, onDismiss };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTakePhoto.mockResolvedValue([PHOTO]);
  mockPickPhoto.mockResolvedValue([PHOTO]);
});

describe('EntryPhotoSheet', () => {
  it('says only the home sees the photo', () => {
    renderSheet();
    expect(
      screen.getByText(
        'Only people in your home see this photo. The catalog keeps its own.',
      ),
    ).toBeTruthy();
  });

  it('sets a photo just taken, then closes once it has landed', async () => {
    const { photo, onDismiss } = renderSheet();

    fireEvent.press(screen.getByTestId(catalogTestIDs.entryPhotoTake));

    await waitFor(() => expect(photo.setOwnPhoto).toHaveBeenCalledWith(PHOTO));
    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });

  it('sets a photo chosen from the library', async () => {
    const { photo } = renderSheet();

    fireEvent.press(screen.getByTestId(catalogTestIDs.entryPhotoChoose));

    await waitFor(() => expect(photo.setOwnPhoto).toHaveBeenCalledWith(PHOTO));
  });

  it('stays open when the photo did not land', async () => {
    const photo = {
      ...entryPhoto(),
      setOwnPhoto: jest.fn().mockResolvedValue(false),
    };
    const { onDismiss } = renderSheet({ entryPhoto: photo });

    fireEvent.press(screen.getByTestId(catalogTestIDs.entryPhotoTake));

    await waitFor(() => expect(photo.setOwnPhoto).toHaveBeenCalled());
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('sends nothing when the capture is cancelled', async () => {
    mockTakePhoto.mockResolvedValue([]);
    const { photo } = renderSheet();

    fireEvent.press(screen.getByTestId(catalogTestIDs.entryPhotoTake));

    await waitFor(() => expect(mockTakePhoto).toHaveBeenCalled());
    expect(photo.setOwnPhoto).not.toHaveBeenCalled();
  });

  it("offers the item's photos only when it has some", () => {
    const onPickItemPhoto = jest.fn();
    renderSheet({ onPickItemPhoto });

    fireEvent.press(screen.getByTestId(catalogTestIDs.entryPhotoPickItemPhoto));

    expect(onPickItemPhoto).toHaveBeenCalled();
  });

  it("hides the item's photos when there are none to pick", () => {
    renderSheet();
    expect(
      screen.queryByTestId(catalogTestIDs.entryPhotoPickItemPhoto),
    ).toBeNull();
  });

  it("offers the catalog photo back only over the household's own", async () => {
    const { photo } = renderSheet({ hasHouseholdPhoto: true });

    fireEvent.press(screen.getByTestId(catalogTestIDs.entryPhotoUseCatalog));

    await waitFor(() => expect(photo.revertToCatalogPhoto).toHaveBeenCalled());
  });

  it('does not offer the catalog photo while it is already shown', () => {
    renderSheet();
    expect(
      screen.queryByTestId(catalogTestIDs.entryPhotoUseCatalog),
    ).toBeNull();
  });

  it('shows progress instead of the choices while saving', () => {
    renderSheet({ entryPhoto: { ...entryPhoto(), busy: true } });
    expect(screen.getByText('Saving the photo…')).toBeTruthy();
    expect(screen.queryByTestId(catalogTestIDs.entryPhotoTake)).toBeNull();
  });
});
