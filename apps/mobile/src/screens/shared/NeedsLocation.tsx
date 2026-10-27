import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from '../../components';
import { useTurnOnLocation } from '../../features/location/LocationGate';
import { colors, layout, radius, spacing } from '../../theme';

// A screen that shows nothing without a fresh location (Discover, the Activity Board).
export function NeedsLocation({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const { turnOn, busy } = useTurnOnLocation();
  return (
    <View style={styles.padded}>
      <EmptyState title={title} body={body}>
        <Button label="Turn on location" onPress={turnOn} loading={busy} />
      </EmptyState>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="pin" size={44} color={colors.orchid} />
      </View>
      <Text variant="h1" accessibilityRole="header" style={styles.center}>
        {title}
      </Text>
      <Text color={colors.secondary} style={styles.center}>
        {body}
      </Text>
      {children ? <View style={styles.emptyActions}>{children}</View> : null}
    </View>
  );
}

const emptyIcon = 96;

const styles = StyleSheet.create({
  padded: {
    flexGrow: 1,
    paddingHorizontal: layout.pageMargin,
    gap: spacing.xs,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.blockGap,
    paddingHorizontal: spacing.xs,
  },
  emptyIcon: {
    width: emptyIcon,
    height: emptyIcon,
    borderRadius: radius.full,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  emptyActions: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
