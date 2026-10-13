import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Icon, Text } from '../../components';
import { useRespondJoinRequest } from '../../features/activities/queries';
import { colors, fontFamily, fonts, sizes, spacing } from '../../theme';

// A waiting Join Request for the host to answer, on the Activity and in the Inbox. With
// onOpen, the requester line also opens the Activity it is for.
export function JoinRequestCard({
  requestId,
  name,
  detail,
  tone,
  onOpen,
  openLabel,
  onAccepted,
}: {
  requestId: string;
  name: string;
  detail?: string;
  tone: number;
  onOpen?: () => void;
  openLabel?: string;
  onAccepted?: (connectionId: string) => void;
}) {
  const answer = useRespondJoinRequest();
  const busy = answer.isPending;
  const respond = (accept: boolean) =>
    answer.mutate(
      { requestId, accept },
      {
        onSuccess: connectionId => {
          if (accept && connectionId) {
            onAccepted?.(connectionId);
          }
        },
      },
    );

  const who = (
    <>
      <Avatar name={name} tone={tone} />
      <View style={styles.grow}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {detail ? (
          <Text variant="bodySmall" color={colors.secondary}>
            {detail}
          </Text>
        ) : null}
      </View>
      {onOpen ? (
        <Icon
          name="chevronRight"
          size={sizes.icon.inline}
          color={colors.secondary}
        />
      ) : null}
    </>
  );

  return (
    <Card style={styles.card}>
      {onOpen ? (
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={openLabel}
          style={styles.who}
        >
          {who}
        </Pressable>
      ) : (
        <View style={styles.who}>{who}</View>
      )}
      {answer.error ? (
        <Text
          variant="bodySmall"
          color={colors.danger}
          accessibilityLiveRegion="polite"
        >
          {answer.error.message}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Accept"
          accessibilityLabel={`Accept ${name}'s join request`}
          compact
          loading={busy && answer.variables?.accept === true}
          disabled={busy}
          onPress={() => respond(true)}
          style={styles.grow}
        />
        <Button
          label="Decline"
          accessibilityLabel={`Decline ${name}'s join request`}
          variant="secondary"
          compact
          loading={busy && answer.variables?.accept === false}
          disabled={busy}
          onPress={() => respond(false)}
          style={styles.grow}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.hitArea,
  },
  grow: { flex: 1, minWidth: 0 },
  name: { fontFamily: fontFamily(fonts.text, '600') },
  actions: { flexDirection: 'row', gap: spacing.xs },
});
