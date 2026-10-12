import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, layout, radius, shadow } from '../theme';

type Props = ViewProps & { feed?: boolean; padded?: boolean };

export function Card({ feed = false, padded = true, style, ...rest }: Props) {
  return (
    <View
      style={[styles.card, feed && styles.feed, padded && styles.padded, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.r24,
    ...shadow('card'),
  },
  feed: { borderRadius: radius.r28, overflow: 'hidden' },
  padded: { padding: layout.cardPadding },
});
