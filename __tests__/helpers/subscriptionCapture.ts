import type { SubscriptionConfig } from '#/services/subscriptions/types';

/** The handler with its client loosened, so a test can hand it a stub client. */
export type CapturedOnData = (data: unknown, client?: unknown) => void;

/**
 * Makes the mocked `subscriptionService.register` keep the hook's
 * `customOnData`, and returns a getter that throws until the hook has mounted.
 */
export const captureOnData = (register: jest.Mock): (() => CapturedOnData) => {
  let customOnData: CapturedOnData | undefined;
  register.mockImplementation((config: SubscriptionConfig) => {
    customOnData = config.customOnData as CapturedOnData | undefined;
    return {};
  });
  return () => {
    if (!customOnData) throw new Error('customOnData was not captured');
    return customOnData;
  };
};
