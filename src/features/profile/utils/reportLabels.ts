import { ReportType } from '#/graphql/generated/schemaTypes';
import type { TranslationKey } from '#/i18n';

/** Keyed by the enum, so a reason the schema gains fails to compile until it is labelled. */
export const REPORT_TYPE_LABEL_KEYS: Record<ReportType, TranslationKey> = {
  [ReportType.Spam]: 'reports.reason.spam',
  [ReportType.InappropriateContent]: 'reports.reason.inappropriateContent',
  [ReportType.Harassment]: 'reports.reason.harassment',
  [ReportType.HateSpeech]: 'reports.reason.hateSpeech',
  [ReportType.FakeInformation]: 'reports.reason.fakeInformation',
  [ReportType.ScamFraud]: 'reports.reason.scamFraud',
  [ReportType.Impersonation]: 'reports.reason.impersonation',
  [ReportType.PrivacyViolation]: 'reports.reason.privacyViolation',
  [ReportType.Copyright]: 'reports.reason.copyright',
  [ReportType.Other]: 'itemType.OTHER',
};
