# Contributing to Sous Chef

Thanks for your interest in contributing! Bug reports, fixes, and feature
contributions are all welcome. Please read the contribution terms below
before submitting a pull request — they explain how the project's
noncommercial license and your contribution rights fit together.

## Contribution Terms

This project is licensed to the public under the
[PolyForm Noncommercial License 1.0.0](LICENSE.md). To keep the project
maintainable and allow the maintainer to distribute the app (including
commercially, e.g. on app stores) without needing per-contributor
permission, contributions are accepted under the following terms.

By submitting a contribution to this repository (a pull request, patch, or
code suggested in an issue), you agree that:

1. **You license your contribution to the project maintainer
   (Artan Muzhaqi) under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)** —
   permitting use, modification, distribution, and sublicensing for any
   purpose, including commercial distribution and future relicensing of the
   project.
2. **Your contribution is licensed to the public** as part of this project
   under the PolyForm Noncommercial License 1.0.0.
3. **You have the right to submit the contribution** — it is your original
   work, or you have sufficient rights to submit it under these terms.

You keep the copyright to your contribution; these are licenses, not a
copyright transfer. If you can't or don't want to agree to these terms,
please open an issue describing the change instead of submitting code.

## Getting Started

### Prerequisites

- Node.js `>= 22.11.0`
- React Native development environment for
  [Android](https://reactnative.dev/docs/set-up-your-environment?platform=android)
  and/or [iOS](https://reactnative.dev/docs/set-up-your-environment?platform=ios)
  (iOS requires macOS with Xcode and CocoaPods)

### Setup

```bash
git clone https://github.com/muzhaqi16/sous-chef-rn.git
cd sous-chef-rn
npm install            # also runs patch-package + generates src/config/env.generated.ts
cp .env.example .env   # then fill in your values (see comments in .env.example)
npm run codegen        # generate GraphQL types from the schema
```

The app talks to a GraphQL backend (`API_URL` in your `.env`). Without a
backend you can still build, typecheck, lint, and run the unit test suite.

### Running the app

```bash
npm start          # Metro bundler
npm run android    # build + run on Android device/emulator
npm run ios        # build + run on iOS simulator (macOS only)
```

## Development Workflow

### After changing `.graphql` files or when the schema changes

```bash
npm run codegen
```

Generated files (`**/*.generated.ts`, `src/graphql/generated/`) are
committed. The pre-push hook regenerates them and fails if your committed
copies are stale.

### Before opening a PR

```bash
npm run typecheck   # TypeScript, app + tests
npm run lint        # ESLint (also validates .graphql operations against the schema)
npm test            # Jest unit tests
```

All three must pass — the same checks run in CI on every pull request.

### Git hooks (installed automatically via husky)

- **pre-commit** — lint-staged: ESLint + Prettier + related Jest tests on
  staged files.
- **commit-msg** — commit messages must follow
  [Conventional Commits](https://www.conventionalcommits.org/) (e.g.
  `fix: correct pantry item sort order`, `feat(recipes): add review sheet`).
- **pre-push** — typecheck, i18n check, codegen orphan check, and codegen
  drift check.

## Pull Request Guidelines

- Target the `main` branch.
- Keep PRs focused — one fix or feature per PR.
- Follow the existing code conventions. `CLAUDE.md` and `docs/` document
  the project's patterns (Apollo cache updates, Unistyles theming, React
  Compiler rules, bottom sheet conventions, testing patterns) — new code
  should match them.
- Add or update tests for behavior changes. Apollo-related tests should use
  the helpers in `__tests__/helpers/apolloMockProvider.tsx`.
- CI runs typecheck, lint, and unit tests on every PR. E2E (Detox) suites
  run on the maintainer's infrastructure; workflow runs on PRs from forks
  require maintainer approval, so they may start with a delay.

## Reporting Issues

- Search existing issues first.
- For bugs, include: platform (Android/iOS), device or emulator, steps to
  reproduce, and expected vs. actual behavior.
- For security issues, please use GitHub's private vulnerability reporting
  instead of a public issue.
