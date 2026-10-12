import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, fontFamily, fonts, modeTints, radius, sizes } from '../theme';
import { Text } from './Text';

type Mode = keyof typeof modeTints;
export type TagTone =
  | 'neutral'
  | 'match'
  | 'butter'
  | 'warn'
  | 'onPhoto'
  | Mode;

const tones: Record<TagTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.tagNeutral, fg: colors.tagNeutralInk },
  match: { bg: colors.tint, fg: colors.orchidDark },
  butter: { bg: colors.butterSoft, fg: colors.ink },
  warn: { bg: colors.warnTint, fg: colors.warnInk },
  onPhoto: { bg: colors.card, fg: colors.ink },
  ...modeTints,
};

// Not tappable; use Chip for anything the Member presses.
export function Tag({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: TagTone;
}) {
  const { bg, fg } = tones[tone];
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text variant="caption" color={fg} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    height: sizes.tag.height,
    paddingHorizontal: sizes.tag.paddingX,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  label: { fontFamily: fontFamily(fonts.text, '500') },
});
