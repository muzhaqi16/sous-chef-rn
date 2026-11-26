import { settingsFields } from '#apollo/utils/unitSystemAnswers';
import {
  CompleteOnboardingDocument,
  UpdateUserPreferencesDocument,
  UpdateUserProfileDocument,
} from '#operations/auth/user.generated';
import { UpdateNotificationPreferencesDocument } from '#operations/user/user.generated';
import { UpdateHomeDocument } from '#operations/home/home.generated';
import { bindLocalWrite } from './bindLocalWrite';
import { entityFields } from './entityFields';
import type { RegisteredBinding } from './types';

// The shared documents' local writes: sent from several features, the kit and
// the auth service, so they belong to the kernel.
export const updateHomeWrite = bindLocalWrite(UpdateHomeDocument, entityFields);
export const updateUserPreferencesWrite = bindLocalWrite(
  UpdateUserPreferencesDocument,
  settingsFields,
);
export const updateNotificationPreferencesWrite = bindLocalWrite(
  UpdateNotificationPreferencesDocument,
  entityFields,
);
export const completeOnboardingWrite = bindLocalWrite(
  CompleteOnboardingDocument,
  entityFields,
);
export const updateUserProfileWrite = bindLocalWrite(
  UpdateUserProfileDocument,
  entityFields,
);

export const SHARED_LOCAL_WRITES: readonly RegisteredBinding[] = [
  updateHomeWrite,
  updateUserPreferencesWrite,
  updateNotificationPreferencesWrite,
  completeOnboardingWrite,
  updateUserProfileWrite,
];
