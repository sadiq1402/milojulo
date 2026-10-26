import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Text } from '../../components';
import { navigationRef } from '../../navigation/navigationRef';
import { colors, layout, radius, shadow, spacing } from '../../theme';

export type Banner = {
  // What to say, and where tapping goes.
  name: string;
  line: string;
  open: () => void;
};

// Long enough to read a line, short enough not to sit over the screen.
const showForMs = 5000;

// What arrives while the app is open (#202). FCM shows nothing in the foreground, and the lists
// used to catch up in silence, so a message or request landed without a word.
export function LiveBanner({
  banner,
  onDismiss,
}: {
  banner?: Banner;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState(banner);

  useEffect(() => {
    if (!banner) {
      return;
    }
    setShown(banner);
    const timer = setTimeout(onDismiss, showForMs);
    return () => clearTimeout(timer);
  }, [banner, onDismiss]);

  const current = banner ?? shown;
  if (!banner || !current) {
    return null;
  }
  return (
    <View style={[styles.holder, { top: insets.top + spacing.xs }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${current.name}: ${current.line}. Opens the chat`}
        onPress={() => {
          onDismiss();
          current.open();
        }}
        style={styles.banner}
      >
        <Avatar name={current.name} size="inline" />
        <View style={styles.grow}>
          <Text variant="title" numberOfLines={1}>
            {current.name}
          </Text>
          <Text variant="bodySmall" color={colors.secondary} numberOfLines={1}>
            {current.line}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

// Nothing to announce about the screen you are already looking at.
export function looksAtChat(connectionId: string): boolean {
  if (!navigationRef.isReady()) {
    return false;
  }
  const route = navigationRef.getCurrentRoute();
  return (
    route?.name === 'Chat' &&
    (route.params as { connectionId?: string } | undefined)?.connectionId ===
      connectionId
  );
}

const styles = StyleSheet.create({
  holder: {
    position: 'absolute',
    left: layout.pageMargin,
    right: layout.pageMargin,
    zIndex: 10,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.r24,
    padding: spacing.sm,
    ...shadow('card'),
  },
  grow: { flex: 1 },
});
