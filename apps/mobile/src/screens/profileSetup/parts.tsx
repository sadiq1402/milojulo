import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from '../../components';
import { colors, fontFamily, fonts, sizes } from '../../theme';

// A labelled group of fields (label 14/20 semibold, 6 above).
export function Field({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text variant="bodySmall" style={styles.label}>
        {label}
      </Text>
      {children}
      {note ? (
        <Text variant="bodySmall" color={colors.secondary}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

type Option<T> = { value: T; label: string };

// Chips over a list of values; the caller decides whether one or several stay chosen.
export function ChoiceChips<T extends string | number>({
  options,
  selected,
  onToggle,
}: {
  options: Option<T>[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map(option => (
        <Chip
          key={String(option.value)}
          label={option.label}
          selected={selected.includes(option.value)}
          onPress={() => onToggle(option.value)}
        />
      ))}
    </View>
  );
}

export const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter(v => v !== value) : [...list, value];

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: fontFamily(fonts.text, '600') },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.chip.gap },
});
