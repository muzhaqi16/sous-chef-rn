import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { MarkItemForReviewDocument } from '#operations/item/item.generated';
import { useReportWrongPhoto } from '#features/catalog/hooks/useReportWrongPhoto';
import { alertService } from '#/services/alertService';
import type { AlertButton } from '#/platform/presenters';
import { changeLanguage } from '#/i18n';

const sentReport = () =>
  recordMock(MarkItemForReviewDocument, {
    data: {
      markItemForReview: {
        __typename: 'MarkItemForReviewPayload',
        alreadyReported: false,
        item: { id: 'item-1' },
      },
    },
  });

const confirmButtons = (): AlertButton[] => {
  const [, , buttons] = jest.mocked(alertService.alert).mock.calls[0] ?? [];
  return buttons ?? [];
};

const press = (label: string) =>
  confirmButtons()
    .find(button => button.text === label)
    ?.onPress?.();

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useReportWrongPhoto', () => {
  it('asks before sending anything', () => {
    const { mock, fired } = sentReport();
    const { result } = renderHookWithApollo(() => useReportWrongPhoto(), {
      operationMocks: [mock],
    });

    result.current.reportWrongPhoto('item-1');

    expect(alertService.alert).toHaveBeenCalledWith(
      'Report this photo?',
      'An admin will check whether it shows this item.',
      expect.any(Array),
    );
    expect(fired).toHaveLength(0);
  });

  it('sends nothing when the user cancels', async () => {
    jest.useFakeTimers();
    const { mock, fired } = sentReport();
    const { result } = renderHookWithApollo(() => useReportWrongPhoto(), {
      operationMocks: [mock],
    });

    result.current.reportWrongPhoto('item-1');
    press('Cancel');

    await drainTimers();
    expect(fired).toHaveLength(0);
  });

  it('flags the item with the wrong-photo reason once confirmed', async () => {
    const { mock, fired } = sentReport();
    const { result } = renderHookWithApollo(() => useReportWrongPhoto(), {
      operationMocks: [mock],
    });

    result.current.reportWrongPhoto('item-1');
    press('Report');

    await waitFor(() =>
      expect(fired).toEqual([
        {
          input: {
            itemId: 'item-1',
            reason: 'The photo shows a different product.',
          },
        },
      ]),
    );
    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Report sent',
        expect.stringContaining('admin'),
      ),
    );
  });

  // App copy translated for the reporter would reach moderators in four languages.
  it('sends the same English reason whatever language the app is in', async () => {
    await changeLanguage('sq');
    const { mock, fired } = sentReport();
    const { result } = renderHookWithApollo(() => useReportWrongPhoto(), {
      operationMocks: [mock],
    });

    result.current.reportWrongPhoto('item-1');
    confirmButtons()
      .find(button => button.style !== 'cancel')
      ?.onPress?.();

    await waitFor(() =>
      expect(fired).toEqual([
        {
          input: {
            itemId: 'item-1',
            reason: 'The photo shows a different product.',
          },
        },
      ]),
    );
    await changeLanguage('en');
  });

  it('names the photo on screen when it is given', async () => {
    const { mock, fired } = sentReport();
    const { result } = renderHookWithApollo(() => useReportWrongPhoto(), {
      operationMocks: [mock],
    });

    result.current.reportWrongPhoto('item-1', 'photo-9');
    press('Report');

    await waitFor(() =>
      expect(fired).toEqual([
        {
          input: {
            itemId: 'item-1',
            reason: 'The photo shows a different product.',
            imageId: 'photo-9',
          },
        },
      ]),
    );
  });
});
