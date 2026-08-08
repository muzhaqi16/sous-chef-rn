'use no memo';

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { ItemImageStatus } from '#/graphql/generated/schemaTypes';
import { MarkPrimaryItemImageDocument } from '#hooks/items/useMarkPrimaryItemImage.generated';
import { ItemPhotoViewer } from '../ItemPhotoViewer';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/utils/compilerSafeWrappers');

/**
 * A literal photo complete for `ItemPhotoCarousel_itemPhoto`. The viewer takes
 * either a masked ref or the materialized object, and codegen inlines the
 * spread into screen types — so this is the shape real callers hold.
 */
const photo = (
  id: string,
  overrides: Partial<{
    isPrimary: boolean;
    status: ItemImageStatus;
    perspective: string | null;
  }> = {},
) => ({
  __typename: 'ItemPhoto' as const,
  id,
  url: `https://cdn.test/${id}.jpg`,
  perspective: null,
  isPrimary: false,
  status: ItemImageStatus.Approved,
  variants: [],
  ...overrides,
});

const renderViewer = (
  props: Partial<React.ComponentProps<typeof ItemPhotoViewer>> = {},
  operationMocks: MockedResponse[] = [],
) =>
  renderWithApollo(
    <ItemPhotoViewer
      visible
      photos={[photo('photo-1')]}
      initialIndex={0}
      onClose={jest.fn()}
      {...props}
    />,
    { operationMocks },
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ItemPhotoViewer set-as-main action', () => {
  // The server gates the mutation on the item's creator or an admin, so a
  // viewer without canEdit must not show an affordance that can only Forbidden.
  it('is hidden without canEdit', () => {
    renderViewer({ canEdit: false });
    expect(screen.queryByLabelText('Set as main photo')).toBeNull();
  });

  it('is offered for an approved, non-primary photo when canEdit', () => {
    renderViewer({ canEdit: true });
    expect(screen.getByLabelText('Set as main photo')).toBeTruthy();
  });

  // markPrimaryItemImage refuses anything but an APPROVED photo, so offering it
  // on a pending upload buys the user a ValidationError and nothing else.
  it('is hidden for a pending photo', () => {
    renderViewer({
      canEdit: true,
      photos: [photo('photo-1', { status: ItemImageStatus.Pending })],
    });
    expect(screen.queryByLabelText('Set as main photo')).toBeNull();
  });

  it('shows a static badge instead once the photo is the hero', () => {
    renderViewer({
      canEdit: true,
      photos: [photo('photo-1', { isPrimary: true })],
    });
    expect(screen.queryByLabelText('Set as main photo')).toBeNull();
    expect(screen.getByText('Main photo')).toBeTruthy();
  });

  it('sends the photo id, not the item id', async () => {
    const { mock, fired } = recordMock(MarkPrimaryItemImageDocument, {
      data: {
        markPrimaryItemImage: {
          __typename: 'MarkPrimaryItemImagePayload',
          item: {
            __typename: 'Item',
            id: 'item-1',
            imageUrl: 'https://cdn.test/photo-1.jpg',
            photos: [photo('photo-1', { isPrimary: true })],
          },
        },
      },
    });

    renderViewer({ canEdit: true }, [mock]);
    fireEvent.press(screen.getByLabelText('Set as main photo'));

    await waitFor(() =>
      expect(fired).toContainEqual({ input: { imageId: 'photo-1' } }),
    );
  });
});
