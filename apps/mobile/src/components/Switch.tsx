import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, sizes } from '../theme';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

const track = { width: 52, height: 32 };
const thumb = 24;
const inset = (track.height - thumb) / 2;
const slop = (sizes.hitArea - track.height) / 2;

// 52 x 32 per the UI standards: orchid track when on, field colour when off.
export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={slop}
      onPress={() => onValueChange(!value)}
      style={[
        styles.track,
        { backgroundColor: value ? colors.orchid : colors.field },
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.thumb, value ? styles.on : styles.off]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { ...track, borderRadius: radius.full, justifyContent: 'center' },
  thumb: {
    width: thumb,
    height: thumb,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  on: { marginLeft: track.width - thumb - inset },
  off: { marginLeft: inset },
  disabled: { opacity: 0.5 },
});
