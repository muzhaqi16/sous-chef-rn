import { byOperation } from '#apollo/utils/documentOperation';
import { settingsFields } from '#apollo/utils/unitSystemAnswers';
import {
  CompleteOnboardingDocument,
  UpdateUserPreferencesDocument,
  UpdateUserProfileDocument,
} from '#operations/auth/user.generated';
import { UpdateNotificationPreferencesDocument } from '#operations/user/user.generated';
import { UpdateHomeDocument } from '#operations/home/home.generated';
import { FEATURE_LOCAL_WRITES } from '#features/registry.data';
import { entityFields } from './entityFields';
import type { LocalWriteTable, RegisteredWrite } from './types';

/**
 * Every local write, keyed by the operation its document declares: the
 * kernel's own over the shared documents, then each feature's.
 */
export const LOCAL_WRITES: LocalWriteTable = byOperation<RegisteredWrite>([
  [UpdateHomeDocument, entityFields],
  [UpdateUserPreferencesDocument, settingsFields],
  [UpdateNotificationPreferencesDocument, entityFields],
  [CompleteOnboardingDocument, entityFields],
  [UpdateUserProfileDocument, entityFields],
  ...FEATURE_LOCAL_WRITES,
]);
