# Web host — what the core is for, and how the web app will run

Decision record, 2026-10-20. The web app is paused; this record governs how it
resumes.

## What the core is

`src/` is split into two layers (`docs/architecture.md` § Layers). The **core**
— the data layer, state, copy, domain logic and start-up, about 40% of the
production lines — runs without React Native: it loads in node with nothing
installed, reaches a device only through the platform ports in `src/platform/`,
and starts through `src/bootstrap/`. The **mobile** layer is the React Native
app.

The core is worth having before a second host exists. Every core file loads and
its flows run in node (`npx jest --selectProjects core-portability`), so a
regression in the data layer is caught without a device, and every reach into
the device is a named port a test installs in memory.

## The web host runs on react-native-web

The web app will be the React Native app rendered by
[react-native-web](https://necolas.github.io/react-native-web/), with
`.web.tsx` files where the web needs its own component, as Bluesky ships iOS,
Android and web from one codebase.

**Why.** It reuses the mobile layer, not only the core: the other 60% of the
lines, every screen and component. Most of the stack already builds for the
web:

| Library                      | On the web                                                    |
| ---------------------------- | ------------------------------------------------------------- |
| Unistyles 3                  | Yes, its own CSS output, independent of react-native-web      |
| FlashList 2                  | Yes, JS-only                                                  |
| `@gorhom/bottom-sheet` 5     | Yes, since v5; keyboard handling on the web lagged at launch  |
| react-native-gesture-handler | Yes, on by default                                            |
| Reanimated 4                 | Ships web builds; no v4 web docs page found                   |
| react-native-mmkv 4          | Yes, over `localStorage`                                      |
| React Navigation 8           | Yes, through react-native-web; static config gives URL paths  |
| NetInfo                      | Yes, so the `connectivity` adapter can likely be shared       |
| keyboard-controller          | No; needs a `.web` stand-in                                   |
| Keychain, device-info        | No; already behind the `secureStore` and `platformInfo` ports |

**The risk: maintenance mode.** react-native-web has no major features
planned. Meta and Expo recommend React Strict DOM for new universal apps and
say an app already on react-native-web should stay; both commit to
maintaining it. A web fix may wait on a slower upstream.

**The exit: React Strict DOM**, adopted component by component through platform
extensions. Everything below the UI — the core, its ports, `src/bootstrap/` —
is the same under either, so the choice can be reversed at the UI layer without
touching the data layer.

**Alternatives considered.**

- **A separate React DOM UI over the core.** The most freedom for desktop
  layouts, and the most UI to write: every screen twice.
- **Adopting Expo for the web.** Expo is the usual way to run
  react-native-web, but this is a bare React Native CLI app, and adopting Expo
  changes its whole toolchain to gain the bundler setup.
- **React Strict DOM now.** Rewrites the UI primitives before the web host is
  even scoped.

## What every host must do

- **Run the React Compiler over the core.** The core's hooks have no
  hand-written `useMemo` or `useCallback`: stable identities come from the
  compiler, so a host that skips it changes behaviour, not only speed.
  `__tests__/core-portability/portabilityTransform.test.ts` holds that the
  portability run compiles the core the same way.
- **Run the Unistyles plugin, `unistyles-scope-crawl` and the React Compiler,
  in that order, over the UI**, and define `__DEV__` (CLAUDE.md § Unistyles).
- **Install the platform before the core runs**, then start it: `startCore`,
  `useCoreReady`, and `useCoreLifecycle` with the host's `StartupHost`
  (`docs/architecture.md` § Platform ports, and the composition root).

## The follow-up: what the web host change will need

- **A third layer category.** Under react-native-web the mobile layer splits
  into the React Native UI the web can run and the modules only a device has:
  the keychain, device info, keyboard-controller, the document scanner, text
  recognition, push, biometrics, haptics and native performance.
- **Web adapters** for each port, and an `installWebPlatform`.
- **A web bundler** for a bare CLI app, such as Vite with
  `vite-plugin-react-native-web`, running the plugins above.
- **Two ports reshaped**, against a real web adapter:
  - cache persistence: the whole cache is serialised to one key of a synchronous
    store every few seconds, which on the web means `localStorage` (a few MB,
    on the main thread); it wants an asynchronous, IndexedDB-backed port;
  - file parts: a picked file is a `uri` appended synchronously; a browser has
    a `Blob`, read asynchronously.
- **API changes**, delivered to the API as a spec:
  - refresh-token custody: the client holds the refresh token (a refresh
    variable, the `/revoke` body, pending revocations); browser guidance is an
    httpOnly cookie or a backend-for-frontend;
  - the WebSocket client key rides an upgrade header, which a browser cannot
    set;
  - what `clientVersion()` and `x-device-id` mean for a web deploy.
- **Locales loaded lazily**: about 900 KB of JSON loads eagerly, fine on a
  device and a cost on a first web load.

## Sources

- React Native Web enters maintenance mode — [The React Native Rewind](https://thereactnativerewind.com/issues-blog-post/react-native-web-enters-maintenance-mode-a-drop-in-photo-gallery-and-the-strictest-button-youve-ever-met)
- React Native in 2026 — [Software Mansion](https://swmansion.com/blog/react-native-in-2026-trends-our-predictions-463a837420c7/)
- React Strict DOM vs React Native for Web — [Infinite Red](https://shift.infinite.red/react-strict-dom-vs-react-native-for-web-in-2025-bb91582ef261)
- One React for web and native — [Nicolas Gallagher](https://nicolasgallagher.com/one-react-for-web-and-native/)
- Bluesky's universal app — [Reading the Bluesky code](https://alexkondov.com/reading-code-bluesky/)
- Unistyles 3 — [Expo blog](https://expo.dev/blog/unistyles-3-0-beyond-react-native-stylesheet) · FlashList v2 — [Shopify](https://shopify.engineering/flashlist-v2) · bottom-sheet v5 — [gorhom](https://gorhom.dev/react-native-bottom-sheet/blog/bottom-sheet-v5) · React Navigation on the web — [docs](https://reactnavigation.org/docs/web-support)
- OAuth 2.0 for browser-based apps — [IETF](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)
