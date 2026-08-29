/**
 * Shared test mock for `#/services/errorService`.
 *
 * Activated per-suite via a bare `jest.mock('#/services/errorService')` (no
 * factory). Provides the COMPLETE module surface, generated from the real module
 * rather than transcribed, so adding an export to `errorService.ts` needs no
 * test edits.
 *
 * That last property is the whole point. Thirty-five suites each declared their
 * own partial factory naming two or three exports, so adding one export to the
 * service broke every suite whose code path happened to reach it — a failure
 * that points at the test file rather than at the change, in thirty-five places
 * at once. `jest.createMockFromModule` reads the surface from the module itself,
 * so it cannot fall behind.
 *
 * The overrides below exist because an automocked function returns `undefined`,
 * and these five return STRINGS that end up on screen. A suite asserting on an
 * alert body needs something to assert.
 *
 *   ```ts
 *   jest.mock('#/services/errorService');
 *   ```
 *
 *   ✅ DO — override per-suite where the value matters:
 *     ```ts
 *     import { localizedErrorMessage } from '#/services/errorService';
 *     jest.mocked(localizedErrorMessage).mockReturnValue('Offline');
 *     ```
 *
 *   ❌ DON'T — re-declare the module with an inline factory. That is the
 *     pattern this file replaces.
 */

import type * as ErrorServiceModuleShape from '../errorService';

type ErrorServiceModule = typeof ErrorServiceModuleShape;

const generated =
  jest.createMockFromModule<ErrorServiceModule>('../errorService');

/** What an unmapped failure shows the user. Deliberately not a real string. */
const GENERIC = 'Something went wrong.';

// `Object.assign` rather than a spread: the automock flattens the class's
// prototype methods onto the instance at runtime, but TypeScript still types
// them as prototype members, so a spread would type as empty and need a cast.
export const errorService: ErrorServiceModule['errorService'] = Object.assign(
  generated.errorService,
  {
    getUserFriendlyMessage: jest.fn(
      (_code: string, fallback?: string) => fallback ?? GENERIC,
    ),
    getErrorCategory: jest.fn(() => 'General'),
    shouldRetry: jest.fn(() => false),
    isAuthError: jest.fn(() => false),
    isExpectedUserError: jest.fn(() => false),
  },
);

export const localizedErrorMessage = jest.fn((): string => GENERIC);

export const errorMessageOr = jest.fn(
  (error: unknown, fallback: string): string =>
    error instanceof Error && error.message ? error.message : fallback,
);

export const useErrorService = jest.fn(() => ({
  ...generated.useErrorService(),
  getUserFriendlyMessage: errorService.getUserFriendlyMessage,
  getErrorCategory: errorService.getErrorCategory,
  shouldRetry: errorService.shouldRetry,
  isAuthError: errorService.isAuthError,
}));

export const ErrorService = generated.ErrorService;
