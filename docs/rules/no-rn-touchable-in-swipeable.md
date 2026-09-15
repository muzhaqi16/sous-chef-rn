# `sous-chef/no-rn-touchable-in-swipeable`

Controls inside a Swipeable use RNGH's Pressable, not RN-based touchables.

## Reports

- Interactive controls inside a Swipeable must use RNGH's Pressable (`import { Pressable } from 'react-native-gesture-handler'`), not AppPressable/PressableScale/Touchable\*. RN touchables don't coordinate with RNGH's gesture arena — they block the swipe or double-fire the row's onPress. See CLAUDE.md "Pressable & Modal Convention".

## Use instead

`import { Pressable } from 'react-native-gesture-handler'`.

## Why

RN touchables live outside RNGH's gesture arena, so inside a swipeable row they block the swipe pan or double-fire the row's `onPress`. RN's own `Pressable` is already an import ban; this covers the RN-based atoms that alias around it.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-rn-touchable-in-swipeable.js`](../../eslint/plugin/rules/no-rn-touchable-in-swipeable.js) · spec: [`__tests__/lint/rules/no-rn-touchable-in-swipeable.test.ts`](../../__tests__/lint/rules/no-rn-touchable-in-swipeable.test.ts)
