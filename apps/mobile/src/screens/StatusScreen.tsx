import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, Text } from '../components';
import { colors, layout } from '../theme';

export function LoadingScreen() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.orchid} accessibilityLabel="Loading" />
    </View>
  );
}

export function LoadErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text>We couldn't reach MiloJulo.</Text>
      <Button label="Try again" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.blockGap,
    padding: layout.pageMargin,
    backgroundColor: colors.ground,
  },
});
