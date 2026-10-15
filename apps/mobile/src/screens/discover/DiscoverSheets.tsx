import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BottomSheet, Button, OptionCard, Text } from '../../components';
import { rangeSteps, type RangeKm } from '../../features/discover/range';
import { modeLabels, type Mode } from '../../features/modes';
import { colors, spacing } from '../../theme';

export function rangeLabel(rangeKm: RangeKm | null): string {
  return rangeKm === null ? 'Anywhere in Pune' : `Within ${rangeKm} km`;
}

// Choices are drafts until Show people; reopening starts from the current value.
function useDraft<T>(visible: boolean, value: T) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (visible) {
      setDraft(value);
    }
  }, [visible, value]);
  return [draft, setDraft] as const;
}

export function DistanceSheet({
  visible,
  value,
  onClose,
  onChoose,
}: {
  visible: boolean;
  value: RangeKm | null;
  onClose: () => void;
  onChoose: (rangeKm: RangeKm | null) => void;
}) {
  const [draft, setDraft] = useDraft(visible, value);
  const options: (RangeKm | null)[] = [...rangeSteps, null];
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="h2" accessibilityRole="header">
        How far?
      </Text>
      <Text variant="bodySmall" color={colors.secondary}>
        Measured from where your phone is. Distances on cards are rounded.
      </Text>
      <ScrollView contentContainerStyle={styles.options}>
        {options.map(km => (
          <OptionCard
            key={km ?? 'anywhere'}
            role="radio"
            compact
            title={km === null ? 'Anywhere in Pune' : `${km} km`}
            checked={draft === km}
            onChange={() => setDraft(km)}
          />
        ))}
      </ScrollView>
      <Button label="Show people" onPress={() => onChoose(draft)} />
    </BottomSheet>
  );
}

const filterModes: Mode[] = [
  'friends',
  'activities',
  'dating',
  'serious',
  'casual',
  'networking',
];

export function ModesSheet({
  visible,
  myModes,
  value,
  onClose,
  onChoose,
}: {
  visible: boolean;
  myModes: Mode[];
  value: Mode[];
  onClose: () => void;
  onChoose: (modes: Mode[]) => void;
}) {
  const [draft, setDraft] = useDraft(visible, value);
  // Only my own Modes: the feed matches on a Mode both people chose, so any other is always empty.
  const shown = filterModes.filter(mode => myModes.includes(mode));
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="h2" accessibilityRole="header">
        Show people here for
      </Text>
      <Text variant="bodySmall" color={colors.secondary}>
        Leave all off to see everyone.
      </Text>
      <ScrollView contentContainerStyle={styles.options}>
        {shown.map(mode => (
          <OptionCard
            key={mode}
            compact
            title={modeLabels[mode]}
            checked={draft.includes(mode)}
            onChange={on =>
              setDraft(
                on ? [...draft, mode] : draft.filter(other => other !== mode),
              )
            }
          />
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <Button
          label="Clear"
          variant="secondary"
          style={styles.action}
          onPress={() => setDraft([])}
        />
        <Button
          label="Show people"
          style={styles.action}
          onPress={() => onChoose(draft)}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  options: { gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.xs },
  action: { flex: 1 },
});
