import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Icon, Text } from '../../components';
import { cannotSendMessage } from '../../features/chat/api';
import type { ChatItem } from '../../features/chat/useChat';
import {
  colors,
  fontFamily,
  fonts,
  shadow,
  sizes,
  spacing,
  textStyles,
} from '../../theme';

type Props = {
  item: ChatItem;
  mine: boolean;
  seen: boolean;
  onRetry: () => void;
  // Only the other Member's sent messages can be reported.
  onReport?: () => void;
};

export function MessageBubble({ item, mine, seen, onRetry, onReport }: Props) {
  if (item.type === 'activity_card') {
    // Opens the Activity once Activities exist (#46).
    return (
      <Card style={styles.activity} accessible accessibilityLabel="Activity">
        <Icon name="activities" color={colors.orchid} />
        <View>
          <Text style={styles.activityTitle}>Activity</Text>
          <Text variant="bodySmall" color={colors.secondary}>
            Shared an Activity
          </Text>
        </View>
      </Card>
    );
  }
  return (
    <View style={[styles.row, mine ? styles.mineRow : styles.theirRow]}>
      <Pressable
        onLongPress={onReport}
        disabled={!onReport}
        accessibilityLabel={item.body ?? undefined}
        accessibilityHint={onReport ? 'Long-press to report' : undefined}
        accessibilityActions={
          onReport ? [{ name: 'report', label: 'Report message' }] : undefined
        }
        onAccessibilityAction={e =>
          e.nativeEvent.actionName === 'report' && onReport?.()
        }
        style={[
          styles.bubble,
          mine ? styles.mine : styles.theirs,
          item.delivery === 'sending' && styles.sending,
        ]}
      >
        <Text style={styles.body} color={mine ? colors.white : colors.ink}>
          {item.body}
        </Text>
      </Pressable>
      {item.delivery === 'sending' ? (
        <Text variant="caption" color={colors.secondary}>
          Sending…
        </Text>
      ) : null}
      {item.delivery === 'failed' ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Not sent. Tap to retry."
          hitSlop={spacing.sm}
        >
          <Text variant="caption" color={colors.danger}>
            Not sent. Tap to retry.
          </Text>
        </Pressable>
      ) : null}
      {item.delivery === 'refused' ? (
        <Text variant="caption" color={colors.danger}>
          {cannotSendMessage}
        </Text>
      ) : null}
      {seen ? (
        <Text variant="caption" color={colors.secondary}>
          Seen
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xxs, maxWidth: `${sizes.chat.bubbleMaxWidthPct}%` },
  mineRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirRow: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    paddingVertical: sizes.chat.bubblePaddingY,
    paddingHorizontal: sizes.chat.bubblePaddingX,
    borderRadius: sizes.chat.bubbleRadius,
  },
  mine: {
    backgroundColor: colors.orchid,
    borderBottomRightRadius: sizes.chat.bubbleTailRadius,
  },
  theirs: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: sizes.chat.bubbleTailRadius,
    ...shadow('card'),
  },
  sending: { opacity: 0.7 },
  body: { ...textStyles.body, lineHeight: sizes.chat.bubbleLineHeight },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
  },
  activityTitle: { fontFamily: fontFamily(fonts.text, '600') },
});
