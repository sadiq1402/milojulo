import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from '../../components';
import { sizes, spacing } from '../../theme';

// The same pin and small text an Activity card uses for its distance.
export function DistanceBand({ band }: { band: string | null }) {
  if (!band) {
    return null;
  }
  return (
    <View style={styles.band}>
      <Icon name="pin" size={sizes.icon.tiny} />
      <Text variant="bodySmall">{band}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});
