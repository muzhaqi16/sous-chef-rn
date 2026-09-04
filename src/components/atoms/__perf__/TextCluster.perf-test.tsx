import React from 'react';
import { View } from 'react-native';
import { measureRenders } from 'reassure';
import { Text } from '#components/atoms/Text';

/**
 * `Text` is the hottest leaf in the app — every list row renders three to five —
 * and it calls `styles.useVariants`, which the React Compiler cannot lower, so
 * the whole component bails out of compilation. A render regression here is
 * invisible to the compiler and multiplied by every row on screen.
 *
 * **Size a scenario above the timer's noise floor.** A single `Text` measures
 * ~0.1 ms, and at that magnitude `check-stability` reported 29.5% and then 4.0%
 * for the identical code — the "instability" was timer granularity, not the
 * machine. Rendering a list-sized batch puts the sample at ~1.7 ms, where the
 * same machine reports 2-3%. If a scenario measures under ~1 ms, it is not
 * measuring anything: make it do more work rather than trusting the number.
 */
const ROWS = Array.from({ length: 40 }, (_, index) => index);

test('Text x40 rows', async () => {
  await measureRenders(
    <View>
      {ROWS.map(index => (
        <View key={index}>
          <Text role="bodyStrong">{`Item ${index}`}</Text>
          <Text role="caption" tone="secondary">
            Fridge
          </Text>
          <Text role="caption" tone="tertiary">
            2 L
          </Text>
        </View>
      ))}
    </View>,
  );
});
