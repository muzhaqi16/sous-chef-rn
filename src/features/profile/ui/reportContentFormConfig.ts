import { mixed, object, string, type ObjectSchema } from 'yup';
import { ReportType } from '#/graphql/generated/schemaTypes';
import { lazyMessage } from '#/utils/validation/common';

export interface ReportContentFormValues {
  /** Null until a reason is picked. */
  type: ReportType | null;
  description: string;
}

export const reportContentDefaults: ReportContentFormValues = {
  type: null,
  description: '',
};

/** Every reason, in the order the form offers them. */
export const REPORT_REASONS: readonly ReportType[] = [
  ReportType.Spam,
  ReportType.InappropriateContent,
  ReportType.Harassment,
  ReportType.HateSpeech,
  ReportType.FakeInformation,
  ReportType.ScamFraud,
  ReportType.Impersonation,
  ReportType.PrivacyViolation,
  ReportType.Copyright,
  ReportType.Other,
];

export const reportContentSchema: ObjectSchema<ReportContentFormValues> =
  object({
    type: mixed<ReportType>()
      .oneOf(Object.values(ReportType))
      .required(lazyMessage('reports.reasonRequired')),
    // The server requires a description only for OTHER.
    description: string()
      .trim()
      .defined()
      .when('type', {
        is: ReportType.Other,
        then: schema =>
          schema.required(lazyMessage('reports.descriptionRequired')),
      }),
  });
