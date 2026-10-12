import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fontFamily, fonts, radius, shadow, sizes } from '../theme';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map(option => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            hitSlop={{
              top: (sizes.hitArea - sizes.segmented.segment) / 2,
              bottom: (sizes.hitArea - sizes.segmented.segment) / 2,
            }}
            style={[styles.segment, active && styles.active]}
          >
            <Text
              variant="label"
              color={active ? colors.ink : colors.secondary}
              style={styles.label}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    minHeight: sizes.segmented.container,
    padding: sizes.segmented.padding,
    gap: sizes.segmented.padding,
    borderRadius: radius.full,
    backgroundColor: colors.tagNeutral,
  },
  segment: {
    flex: 1,
    minHeight: sizes.segmented.segment,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: colors.card, ...shadow('segment') },
  label: { fontFamily: fontFamily(fonts.text, '600') },
});
