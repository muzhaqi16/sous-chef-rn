'use no memo';

import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { ItemImageStatus } from '#/graphql/generated/schemaTypes';
import { MarkPrimaryItemImageDocument } from '#features/catalog/hooks/useMarkPrimaryItemImage.generated';
import { MarkItemForReviewDocument } from '#operations/item/item.generated';
import { alertService } from '#/services/alertService';
import { ItemPhotoViewer } from '../ItemPhotoViewer';
import type { ItemPhotoCarousel_ItemPhotoFragment } from '#features/catalog/ui/ItemPhotoCarousel.generated';

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
    credit: ItemPhotoCarousel_ItemPhotoFragment['credit'];
  }> = {},
): ItemPhotoCarousel_ItemPhotoFragment => ({
  __typename: 'ItemPhoto',
  id,
  url: `https://cdn.test/${id}.jpg`,
  perspective: null,
  isPrimary: false,
  status: ItemImageStatus.Approved,
  credit: null,
  variants: [],
  ...overrides,
});

const OWN_ITEM = { id: 'item-1', canEdit: true, canSuggest: false };
const PUBLIC_ITEM = { id: 'item-1', canEdit: false, canSuggest: true };

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
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ItemPhotoViewer set-as-main action', () => {
  // The server gates the mutation on the item's creator or an admin, so a
  // viewer without canEdit must not show an affordance that can only Forbidden.
  it('is hidden without canEdit', () => {
    renderViewer({ item: { id: 'item-1', canEdit: false, canSuggest: false } });
    expect(screen.queryByLabelText('Set as main photo')).toBeNull();
  });

  it('is hidden on a public item, even for an admin', () => {
    renderViewer({ item: { id: 'item-1', canEdit: true, canSuggest: true } });
    expect(screen.queryByLabelText('Set as main photo')).toBeNull();
  });

  it("is offered for an approved, non-primary photo of the viewer's own item", () => {
    renderViewer({ item: OWN_ITEM });
    expect(screen.getByLabelText('Set as main photo')).toBeTruthy();
  });

  // markPrimaryItemImage refuses anything but an APPROVED photo, so offering it
  // on a pending upload buys the user a ValidationError and nothing else.
  it('is hidden for a pending photo', () => {
    renderViewer({
      item: OWN_ITEM,
      photos: [photo('photo-1', { status: ItemImageStatus.Pending })],
    });
    expect(screen.queryByLabelText('Set as main photo')).toBeNull();
  });

  it('shows a static badge instead once the photo is the hero', () => {
    renderViewer({
      item: OWN_ITEM,
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
            id: 'item-1',
            imageUrl: 'https://cdn.test/photo-1.jpg',
            photos: [photo('photo-1', { isPrimary: true })],
          },
        },
      },
    });

    renderViewer({ item: OWN_ITEM }, [mock]);
    fireEvent.press(screen.getByLabelText('Set as main photo'));

    await drainTimers();
    expect(fired).toContainEqual({ input: { imageId: 'photo-1' } });
  });
});

describe('ItemPhotoViewer report action', () => {
  it("is offered on a public item's approved photo", () => {
    renderViewer({ item: PUBLIC_ITEM });
    expect(screen.getByLabelText('Report wrong photo')).toBeTruthy();
  });

  // A pending photo is the viewer's own submission.
  it('is hidden for a pending photo', () => {
    renderViewer({
      item: PUBLIC_ITEM,
      photos: [photo('photo-1', { status: ItemImageStatus.Pending })],
    });
    expect(screen.queryByLabelText('Report wrong photo')).toBeNull();
  });

  it("is hidden on the viewer's own private item", () => {
    renderViewer({ item: OWN_ITEM });
    expect(screen.queryByLabelText('Report wrong photo')).toBeNull();
  });

  it('is hidden when the viewer is read-only', () => {
    renderViewer();
    expect(screen.queryByLabelText('Report wrong photo')).toBeNull();
  });

  it('asks before reporting the item', () => {
    renderViewer({ item: PUBLIC_ITEM });
    fireEvent.press(screen.getByLabelText('Report wrong photo'));
    expect(alertService.alert).toHaveBeenCalledWith(
      'Report this photo?',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('names the photo on screen in the report', async () => {
    const report = recordMock(MarkItemForReviewDocument, {
      data: {
        markItemForReview: {
          __typename: 'MarkItemForReviewPayload',
          alreadyReported: false,
          item: { id: 'item-1' },
        },
      },
    });
    renderViewer({ item: PUBLIC_ITEM }, [report.mock]);

    fireEvent.press(screen.getByLabelText('Report wrong photo'));
    const [, , buttons] = jest.mocked(alertService.alert).mock.calls[0] ?? [];
    buttons?.find(button => button.text === 'Report')?.onPress?.();

    await drainTimers();
    expect(report.fired).toEqual([
      expect.objectContaining({
        input: expect.objectContaining({ imageId: 'photo-1' }),
      }),
    ]);
  });
});

describe('ItemPhotoViewer use-this-photo action', () => {
  const choice = (currentPhotoId: string | null, onUse = jest.fn()) => ({
    currentPhotoId,
    onUse,
  });

  it("uses the approved photo on screen for the household's entries", () => {
    const onUse = jest.fn();
    renderViewer({ entryPhoto: choice(null, onUse) });

    fireEvent.press(screen.getByLabelText('Use this photo'));

    expect(onUse).toHaveBeenCalledWith('photo-1');
  });

  it('is hidden on the photo the entries already show', () => {
    renderViewer({ entryPhoto: choice('photo-1') });
    expect(screen.queryByLabelText('Use this photo')).toBeNull();
  });

  it('is hidden for a pending photo, which the server refuses', () => {
    renderViewer({
      photos: [photo('photo-1', { status: ItemImageStatus.Pending })],
      entryPhoto: choice(null),
    });
    expect(screen.queryByLabelText('Use this photo')).toBeNull();
  });

  it('is not offered without a household choice to make', () => {
    renderViewer({ item: PUBLIC_ITEM });
    expect(screen.queryByLabelText('Use this photo')).toBeNull();
  });
});

describe('ItemPhotoViewer credit', () => {
  it('credits the licensed photo on screen', () => {
    renderViewer({
      photos: [
        photo('photo-1', {
          credit: {
            __typename: 'ImageCredit',
            text: 'Open Food Facts',
            license: 'CC BY-SA 3.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
            sourceUrl: 'https://world.openfoodfacts.org/product/1',
          },
        }),
      ],
    });

    expect(screen.getByText('Photo: Open Food Facts')).toBeTruthy();
    expect(screen.getByText('CC BY-SA 3.0')).toBeTruthy();
  });

  it('shows no credit for a photo that needs none', () => {
    renderViewer();
    expect(screen.queryByText(/^Photo:/)).toBeNull();
  });
});
